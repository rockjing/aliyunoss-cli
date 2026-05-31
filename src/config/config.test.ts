import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { ConfigManager } from './config.js';
import { defaultConfig } from './schema.js';
import { MCPError } from '../types/index.js';
import { REDACTED_VALUE } from '../security/redaction.js';

const ENV_KEYS = [
  'OSS_ACCESS_KEY_ID',
  'OSS_ACCESS_KEY_SECRET',
  'OSS_BUCKET',
  'OSS_REGION',
  'NODE_ENV'
] as const;

describe('ConfigManager secret redaction', () => {
  const originalEnv = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv.set(key, process.env[key]);
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

  it('returns redacted public config while preserving OSS runtime config', async () => {
    process.env.OSS_ACCESS_KEY_ID = 'LTAI1234567890ABCD';
    process.env.OSS_ACCESS_KEY_SECRET = 'super-secret-value';
    process.env.OSS_BUCKET = 'example-bucket';
    process.env.OSS_REGION = 'oss-cn-hangzhou';
    process.env.NODE_ENV = 'testing';

    const manager = new ConfigManager();
    const loadedConfig = await manager.loadConfig();
    const publicConfig = manager.getConfig();
    const ossPublicConfig = manager.getOSSConfig();
    const ossRuntimeConfig = manager.getOSSRuntimeConfig();
    const summary = manager.getConfigSummary();

    expect(loadedConfig.oss.accessKeyId).toBe('LTAI***ABCD');
    expect(publicConfig.oss.accessKeySecret).toBe(REDACTED_VALUE);
    expect(ossPublicConfig.accessKeySecret).toBe(REDACTED_VALUE);
    expect(ossRuntimeConfig.accessKeyId).toBe('LTAI1234567890ABCD');
    expect(ossRuntimeConfig.accessKeySecret).toBe('super-secret-value');
    expect(JSON.stringify(summary)).not.toContain('super-secret-value');
  });

  it('redacts invalid config details in MCPError serialization', () => {
    const manager = new ConfigManager();
    const unsafeConfig = {
      ...defaultConfig,
      oss: {
        ...defaultConfig.oss,
        accessKeyId: 'LTAI1234567890ABCD',
        accessKeySecret: 'super-secret-value',
        bucket: '',
        region: 'oss-cn-hangzhou'
      }
    };

    expect(() => manager.validateConfig(unsafeConfig)).toThrow(MCPError);

    try {
      manager.validateConfig(unsafeConfig);
    } catch (error) {
      const serialized = JSON.stringify((error as MCPError).toJSON());
      expect(serialized).toContain(REDACTED_VALUE);
      expect(serialized).not.toContain('super-secret-value');
    }
  });

  it('loads OSS credentials from an explicit JSON file with environment-style fields', async () => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }

    const tempDir = mkdtempSync(join(tmpdir(), 'aliyunoss-credentials-'));
    const credentialsFile = join(tempDir, 'credentials.json');
    writeFileSync(
      credentialsFile,
      JSON.stringify({
        OSS_ACCESS_KEY_ID: 'LTAI_FILE_1234567890',
        OSS_ACCESS_KEY_SECRET: 'file-secret-value',
        OSS_BUCKET: 'file-bucket',
        OSS_REGION: 'oss-cn-beijing',
        OSS_SECURE: 'false',
        OSS_TIMEOUT: '45'
      })
    );

    try {
      const manager = new ConfigManager({ credentialsFile });
      await manager.loadConfig();
      const runtimeConfig = manager.getOSSRuntimeConfig();
      const summary = JSON.stringify(manager.getConfigSummary());

      expect(runtimeConfig).toMatchObject({
        accessKeyId: 'LTAI_FILE_1234567890',
        accessKeySecret: 'file-secret-value',
        bucket: 'file-bucket',
        region: 'oss-cn-beijing',
        secure: false,
        timeout: 45
      });
      expect(summary).not.toContain('file-secret-value');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('lets explicit nested OSS credentials override environment variables', async () => {
    process.env.OSS_ACCESS_KEY_ID = 'LTAI_ENV_1234567890';
    process.env.OSS_ACCESS_KEY_SECRET = 'env-secret-value';
    process.env.OSS_BUCKET = 'env-bucket';
    process.env.OSS_REGION = 'oss-cn-hangzhou';
    process.env.NODE_ENV = 'testing';

    const tempDir = mkdtempSync(join(tmpdir(), 'aliyunoss-credentials-'));
    const credentialsFile = join(tempDir, 'credentials.json');
    writeFileSync(
      credentialsFile,
      JSON.stringify({
        oss: {
          accessKeyId: 'LTAI_JSON_1234567890',
          accessKeySecret: 'json-secret-value',
          bucket: 'json-bucket',
          region: 'oss-cn-shanghai'
        }
      })
    );

    try {
      const manager = new ConfigManager({ credentialsFile });
      await manager.loadConfig();
      const runtimeConfig = manager.getOSSRuntimeConfig();

      expect(runtimeConfig.accessKeyId).toBe('LTAI_JSON_1234567890');
      expect(runtimeConfig.accessKeySecret).toBe('json-secret-value');
      expect(runtimeConfig.bucket).toBe('json-bucket');
      expect(runtimeConfig.region).toBe('oss-cn-shanghai');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
