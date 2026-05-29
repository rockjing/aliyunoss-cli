import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { ErrorCode, MCPError } from '../../types/index.js';
import type { FileMetadata, StorageConfig, StorageService } from '../../storage/index.js';
import { parseCliArgs } from '../parser.js';
import { createOssCommands } from './oss.js';

const ENV_KEYS = [
  'OSS_ACCESS_KEY_ID',
  'OSS_ACCESS_KEY_SECRET',
  'OSS_BUCKET',
  'OSS_REGION',
  'NODE_ENV'
] as const;

describe('OSS CLI commands', () => {
  const originalEnv = new Map<string, string | undefined>();
  let storage: StorageService;
  let receivedConfig: StorageConfig | undefined;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv.set(key, process.env[key]);
    }

    process.env.OSS_ACCESS_KEY_ID = 'LTAI1234567890ABCD';
    process.env.OSS_ACCESS_KEY_SECRET = 'super-secret-value';
    process.env.OSS_BUCKET = 'example-bucket';
    process.env.OSS_REGION = 'oss-cn-hangzhou';
    process.env.NODE_ENV = 'testing';
    receivedConfig = undefined;
    storage = createMockStorage();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    for (const key of ENV_KEYS) {
      const value = originalEnv.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    originalEnv.clear();
  });

  it('uploads a local file through storage with a validated object key', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'aliyunoss-cli-'));
    const filePath = join(tempDir, 'report.txt');
    writeFileSync(filePath, 'hello oss');

    try {
      const result = await runCommand(['upload', filePath, '--key', 'documents/report.txt']);

      expect(storage.uploadFile).toHaveBeenCalledWith(
        Buffer.from('hello oss'),
        'documents/report.txt',
        { contentType: 'text/plain' }
      );
      expect(storage.generateTempUrl).toHaveBeenCalledWith('documents/report.txt', 3600);
      expect(result.data.size).toBe(9);
      expect(result.data.url).toBe('https://example.com/documents/report.txt');
      expect(receivedConfig?.accessKeySecret).toBe('super-secret-value');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('generates a temporary URL after checking metadata', async () => {
    const result = await runCommand(['url', 'documents/report.txt', '--expires', '120']);

    expect(storage.getFileMetadata).toHaveBeenCalledWith('documents/report.txt');
    expect(storage.generateTempUrl).toHaveBeenCalledWith('documents/report.txt', 120);
    expect(result.data.expires).toBe(120);
    expect(result.data.expiresAt).toBe('2026-05-29T12:02:00.000Z');
  });

  it('lists objects with prefix and pagination options', async () => {
    const result = await runCommand([
      'list',
      '--prefix',
      'documents/',
      '--max-keys',
      '10',
      '--marker',
      'next',
      '--delimiter',
      '/'
    ]);

    expect(storage.listFiles).toHaveBeenCalledWith({
      prefix: 'documents/',
      maxKeys: 10,
      marker: 'next',
      delimiter: '/'
    });
    expect(result.data.count).toBe(1);
    expect(result.data.objects).toEqual([
      {
        name: 'documents/report.txt',
        size: 9,
        lastModified: '2026-05-29T12:00:00.000Z',
        etag: 'etag-report',
        storageClass: 'Standard',
        contentType: 'text/plain'
      }
    ]);
  });

  it('copies an object and honors --no-overwrite', async () => {
    (storage.getFileMetadata as jest.Mock)
      .mockResolvedValueOnce(createMetadata('documents/source.txt'))
      .mockRejectedValueOnce(new MCPError(ErrorCode.FILE_NOT_FOUND, 'not found'));

    const result = await runCommand([
      'copy',
      'documents/source.txt',
      'documents/target.txt',
      '--no-overwrite'
    ]);

    expect(storage.copyFile).toHaveBeenCalledWith('documents/source.txt', 'documents/target.txt');
    expect(result.data.overwrite).toBe(false);
    expect(result.data.success).toBe(true);
  });

  it('returns object metadata', async () => {
    const result = await runCommand(['meta', 'documents/report.txt']);

    expect(storage.getFileMetadata).toHaveBeenCalledWith('documents/report.txt');
    expect(result.data).toMatchObject({
      fileName: 'documents/report.txt',
      key: 'documents/report.txt',
      size: 9,
      contentType: 'text/plain',
      etag: 'etag-report',
      storageClass: 'Standard'
    });
  });

  it('rejects unsafe object keys before calling storage', async () => {
    await expect(runCommand(['url', '../secret.txt'])).rejects.toThrow(MCPError);
    expect(storage.generateTempUrl).not.toHaveBeenCalled();
  });

  async function runCommand(args: string[]) {
    const parsed = parseCliArgs(args);
    const command = createOssCommands({
      createStorage: (config) => {
        receivedConfig = config;
        return storage;
      },
      now: () => new Date('2026-05-29T12:00:00.000Z')
    }).find((item) => item.name === parsed.command);

    if (!command) {
      throw new Error(`Command not found: ${parsed.command}`);
    }

    return command.run({ parsed });
  }
});

function createMockStorage(): StorageService {
  return {
    uploadFile: jest.fn(async (_content: Buffer, filename: string) => filename),
    generateTempUrl: jest.fn(async (filename: string) => `https://example.com/${filename}`),
    deleteFile: jest.fn(),
    listExpiredFiles: jest.fn(async () => []),
    getFileContent: jest.fn(async () => Buffer.from('')),
    listFiles: jest.fn(async () => ({
      objects: [createMetadata('documents/report.txt')],
      prefixes: [],
      nextMarker: 'next-marker',
      isTruncated: false,
      maxKeys: 10,
      prefix: 'documents/'
    })),
    copyFile: jest.fn(),
    getFileMetadata: jest.fn(async (filename: string) => createMetadata(filename)),
    checkConnection: jest.fn(async () => true),
    getConfig: jest.fn()
  };
}

function createMetadata(name: string): FileMetadata {
  return {
    name,
    size: 9,
    lastModified: new Date('2026-05-29T12:00:00.000Z'),
    contentType: 'text/plain',
    etag: 'etag-report',
    storageClass: 'Standard',
    metadata: {
      owner: 'cli-test'
    }
  };
}
