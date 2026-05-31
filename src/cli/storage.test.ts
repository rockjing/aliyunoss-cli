import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import type { StorageConfig, StorageService } from '../storage/index.js';
import { parseCliArgs } from './parser.js';
import { createCliStorageRuntime } from './storage.js';

const ENV_KEYS = [
  'OSS_ACCESS_KEY_ID',
  'OSS_ACCESS_KEY_SECRET',
  'OSS_BUCKET',
  'OSS_REGION',
  'NODE_ENV'
] as const;

describe('CLI storage runtime', () => {
  const originalEnv = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
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

  it('creates storage from a credentials JSON file', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'aliyunoss-cli-credentials-'));
    const credentialsFile = join(tempDir, 'credentials.json');
    let receivedConfig: StorageConfig | undefined;
    writeFileSync(
      credentialsFile,
      JSON.stringify({
        accessKeyId: 'LTAI_JSON_1234567890',
        accessKeySecret: 'json-secret-value',
        bucket: 'json-bucket',
        region: 'oss-cn-beijing'
      })
    );

    try {
      const parsed = parseCliArgs(['list', '--credentials', credentialsFile]);
      const runtime = await createCliStorageRuntime(parsed, (config) => {
        receivedConfig = config;
        return createMockStorage();
      });

      expect(runtime.bucket).toBe('json-bucket');
      expect(runtime.region).toBe('oss-cn-beijing');
      expect(receivedConfig).toMatchObject({
        accessKeyId: 'LTAI_JSON_1234567890',
        accessKeySecret: 'json-secret-value',
        bucket: 'json-bucket',
        region: 'oss-cn-beijing'
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

function createMockStorage(): StorageService {
  return {
    uploadFile: jest.fn(),
    generateTempUrl: jest.fn(),
    deleteFile: jest.fn(),
    listExpiredFiles: jest.fn(async () => []),
    getFileContent: jest.fn(async () => Buffer.from('')),
    checkConnection: jest.fn(async () => true),
    getConfig: jest.fn()
  };
}
