/**
 * aliyunoss-cli - OSS 存储运行时
 *
 * @fileoverview 创建 OSSStorageService，并提供测试可替换的存储工厂
 * @author aigroup-aliyunoss-mcp team
 * @version 1.0.0
 */

import { createConfigManager } from '../config/index.js';
import type { OSSConfigType } from '../config/index.js';
import { OSSStorageService } from '../storage/index.js';
import type { StorageConfig, StorageService } from '../storage/index.js';
import { withConsoleLogsOnStderr } from './runtime.js';
import type { ParsedCliArgs } from './types.js';

export type CliStorageFactory = (config: StorageConfig) => StorageService;

export interface CliStorageRuntime {
  storage: StorageService;
  bucket: string;
  region: string;
}

export async function createCliStorageRuntime(
  parsed: ParsedCliArgs,
  createStorage: CliStorageFactory = createDefaultStorage
): Promise<CliStorageRuntime> {
  const configManager = createConfigManager({ configFile: parsed.options.configFile });
  await withConsoleLogsOnStderr(() => configManager.loadConfig());
  const ossConfig = configManager.getOSSRuntimeConfig();

  return {
    storage: createStorage(toStorageConfig(ossConfig)),
    bucket: ossConfig.bucket,
    region: ossConfig.region
  };
}

export function toStorageConfig(config: OSSConfigType): StorageConfig {
  const storageConfig: StorageConfig = {
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket,
    region: config.region,
    secure: config.secure,
    timeout: config.timeout,
    internal: config.internal,
    isRequestPay: config.isRequestPay
  };

  if (config.cname) {
    storageConfig.cname = config.cname;
  }

  if (config.stsToken) {
    storageConfig.stsToken = config.stsToken;
  }

  return storageConfig;
}

function createDefaultStorage(config: StorageConfig): StorageService {
  return new OSSStorageService(config, createCliLogger());
}

function createCliLogger() {
  return {
    debug: (_message: string, _data?: unknown) => undefined,
    info: (_message: string, _data?: unknown) => undefined,
    warn: (message: string) => process.stderr.write(`${message}\n`),
    error: (message: string) => process.stderr.write(`${message}\n`)
  };
}
