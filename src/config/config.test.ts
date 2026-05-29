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
});
