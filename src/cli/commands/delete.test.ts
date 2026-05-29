import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import type { StorageConfig, StorageService } from '../../storage/index.js';
import { CliError } from '../errors.js';
import { parseCliArgs } from '../parser.js';
import { createDeleteCommands } from './delete.js';

const ENV_KEYS = [
  'OSS_ACCESS_KEY_ID',
  'OSS_ACCESS_KEY_SECRET',
  'OSS_BUCKET',
  'OSS_REGION',
  'NODE_ENV'
] as const;

describe('delete CLI commands', () => {
  const originalEnv = new Map<string, string | undefined>();
  let storage: StorageService;
  let receivedConfig: StorageConfig | undefined;
  let confirm: jest.Mock<Promise<void>, any[]>;
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
    storage = createMockStorage();
    receivedConfig = undefined;
    confirm = jest.fn(async () => undefined);
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

  it('deletes one object only after confirmation', async () => {
    const result = await runCommand(['delete', 'documents/report.pdf']);

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'delete',
      bucket: 'example-bucket',
      region: 'oss-cn-hangzhou',
      keys: ['documents/report.pdf'],
      yes: false,
      dryRun: false
    }));
    expect(storage.deleteFile).toHaveBeenCalledWith('documents/report.pdf');
    expect(result.data.success).toBe(true);
    expect(receivedConfig?.accessKeySecret).toBe('super-secret-value');
  });

  it('does not call deleteFile during delete dry-run', async () => {
    const result = await runCommand(['delete', 'documents/report.pdf', '--dry-run']);

    expect(result.data.dryRun).toBe(true);
    expect(result.data.keys).toEqual(['documents/report.pdf']);
    expect(storage.deleteFile).not.toHaveBeenCalled();
    expect(storage.deleteMultipleFiles).not.toHaveBeenCalled();
  });

  it('batch deletes unique keys from a list file with --yes', async () => {
    const { tempDir, filePath } = createDeleteList([
      'documents/a.pdf',
      'documents/b.pdf',
      'documents/a.pdf'
    ]);

    try {
      const result = await runCommand(['delete-many', '--file', filePath, '--yes']);

      expect(confirm).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'delete-many',
        keys: ['documents/a.pdf', 'documents/b.pdf'],
        yes: true
      }));
      expect(storage.deleteMultipleFiles).toHaveBeenCalledWith([
        'documents/a.pdf',
        'documents/b.pdf'
      ]);
      expect(result.data).toMatchObject({
        total: 2,
        successCount: 2,
        errorCount: 0
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('does not call delete interfaces during delete-many dry-run', async () => {
    const { tempDir, filePath } = createDeleteList(['documents/a.pdf', 'documents/b.pdf']);

    try {
      const result = await runCommand(['delete-many', '--file', filePath, '--dry-run']);

      expect(result.data.dryRun).toBe(true);
      expect(result.data.count).toBe(2);
      expect(storage.deleteMultipleFiles).not.toHaveBeenCalled();
      expect(storage.deleteFile).not.toHaveBeenCalled();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects unsafe keys before deleting', async () => {
    await expect(runCommand(['delete', '../secret.txt', '--yes'])).rejects.toThrow();
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });

  it('rejects more than 1000 delete-many keys', async () => {
    const keys = Array.from({ length: 1001 }, (_value, index) => `documents/${index}.txt`);
    const { tempDir, filePath } = createDeleteList(keys);

    try {
      await expect(runCommand(['delete-many', '--file', filePath, '--yes'])).rejects.toThrow(CliError);
      expect(storage.deleteMultipleFiles).not.toHaveBeenCalled();
      expect(storage.deleteFile).not.toHaveBeenCalled();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  async function runCommand(args: string[]) {
    const parsed = parseCliArgs(args);
    const command = createDeleteCommands({
      createStorage: (config) => {
        receivedConfig = config;
        return storage;
      },
      now: () => new Date('2026-05-29T12:00:00.000Z'),
      confirm
    }).find((item) => item.name === parsed.command);

    if (!command) {
      throw new Error(`Command not found: ${parsed.command}`);
    }

    return command.run({ parsed });
  }
});

function createMockStorage(): StorageService {
  return {
    uploadFile: jest.fn(),
    generateTempUrl: jest.fn(),
    deleteFile: jest.fn(),
    listExpiredFiles: jest.fn(async () => []),
    getFileContent: jest.fn(async () => Buffer.from('')),
    deleteMultipleFiles: jest.fn(async (keys: string[]) => ({
      deleted: keys.map((key) => ({ key })),
      errors: []
    })),
    checkConnection: jest.fn(async () => true),
    getConfig: jest.fn()
  };
}

function createDeleteList(keys: string[]): { tempDir: string; filePath: string } {
  const tempDir = mkdtempSync(join(tmpdir(), 'aliyunoss-delete-cli-'));
  const filePath = join(tempDir, 'delete-list.txt');
  writeFileSync(filePath, keys.join('\n'));
  return { tempDir, filePath };
}
