/**
 * aliyunoss-cli - 基础命令
 *
 * @fileoverview 提供 help、version、validate-config、health 和 stdio 过渡命令
 * @author aigroup-aliyunoss-mcp team
 * @version 1.0.0
 */

import { readFileSync } from 'fs';

import { createConfigManager } from '../../config/index.js';
import { OSSStorageService } from '../../storage/index.js';
import type { StorageConfig } from '../../storage/index.js';
import type { OSSConfigType } from '../../config/index.js';
import { HealthStatus, LogLevel } from '../../types/index.js';
import { CliError, CliExitCode } from '../errors.js';
import { ensureNoExtraArgs } from '../parser.js';
import { withConsoleLogsOnStderr } from '../runtime.js';
import type { CliCommand, CliCommandContext, CliCommandResult } from '../types.js';

const TOOL_NAME = 'aliyunoss-cli';

export function createCoreCommands(): CliCommand[] {
  return [
    {
      name: 'help',
      aliases: ['--help', '-h'],
      summary: '显示帮助信息',
      usage: `${TOOL_NAME} [command] [options]`,
      run: async ({ parsed }) => {
        ensureNoExtraArgs(parsed, 'help');
        return {
          command: 'help',
          data: { usage: getHelpText() },
          text: getHelpText()
        };
      }
    },
    {
      name: 'version',
      aliases: ['--version', '-v'],
      summary: '显示版本号',
      usage: `${TOOL_NAME} --version`,
      run: async ({ parsed }) => {
        ensureNoExtraArgs(parsed, 'version');
        const version = readPackageVersion();
        return {
          command: 'version',
          data: { version },
          text: version
        };
      }
    },
    {
      name: 'validate-config',
      aliases: ['validate'],
      summary: '验证当前配置并输出脱敏摘要',
      usage: `${TOOL_NAME} validate-config [--json] [--config <path>] [--credentials <path>]`,
      run: runValidateConfig
    },
    {
      name: 'health',
      summary: '检查配置、OSS 连接和本地运行状态',
      usage: `${TOOL_NAME} health [--json] [--config <path>] [--credentials <path>]`,
      run: runHealth
    },
    {
      name: 'stdio',
      aliases: ['--stdio'],
      summary: '以 MCP stdio 模式启动旧入口（过渡兼容）',
      usage: `${TOOL_NAME} stdio`,
      run: async ({ parsed }) => {
        ensureNoExtraArgs(parsed, 'stdio');
        await import('../../index.js');
        return {
          command: 'stdio',
          data: { started: true },
          text: 'MCP stdio server started'
        };
      }
    }
  ];
}

export function getHelpText(): string {
  return `aliyunoss-cli v${readPackageVersion()}

Usage:
  aliyunoss-cli <command> [options]

Commands:
  help                 Show help information
  version              Show version
  validate-config      Validate configuration and print a redacted summary
  health               Check configuration, OSS connectivity and process health
  upload               Upload a local file to OSS
  url                  Generate a temporary object URL
  list                 List OSS objects by prefix
  copy                 Copy an OSS object
  symlink              Create an OSS symlink object
  meta                 Show OSS object metadata
  delete               Delete one OSS object with confirmation
  delete-many          Delete OSS objects from a local list file
  stdio                Start the legacy MCP stdio entry for transition

Global options:
  --json               Print stable JSON output
  --config <path>      Load a specific config file
  --credentials <path> Load OSS credentials from a JSON file
  --profile <name>     Reserved profile name for future config support
  --log-level <level>  Set log level for the current run
  --dry-run            Reserved for dangerous commands
  --yes                Reserved for non-interactive confirmation
  --help, -h           Show help information
  --version, -v        Show version

Examples:
  aliyunoss-cli --help
  aliyunoss-cli --version
  aliyunoss-cli validate-config --credentials ./credentials.json --json
  aliyunoss-cli health
  aliyunoss-cli upload ./report.pdf --key documents/report.pdf
  aliyunoss-cli list --prefix documents/ --max-keys 10 --json
  aliyunoss-cli copy documents/a.pdf documents/b.pdf --no-overwrite
  aliyunoss-cli symlink documents/report.pdf /latest/report.pdf --no-overwrite
  aliyunoss-cli delete documents/report.pdf
  aliyunoss-cli delete-many --file ./delete-list.txt --dry-run
  aliyunoss-cli stdio`;
}

async function runValidateConfig({ parsed }: CliCommandContext): Promise<CliCommandResult> {
  ensureNoExtraArgs(parsed, 'validate-config');
  applyLogLevel(parsed.options.logLevel);

  const configManager = createConfigManager({
    configFile: parsed.options.configFile,
    credentialsFile: parsed.options.credentialsFile
  });
  await withConsoleLogsOnStderr(() => configManager.loadConfig());

  const summary = configManager.getConfigSummary();
  return {
    command: 'validate-config',
    data: { summary },
    text: formatConfigSummary(summary)
  };
}

async function runHealth({ parsed }: CliCommandContext): Promise<CliCommandResult> {
  ensureNoExtraArgs(parsed, 'health');
  applyLogLevel(parsed.options.logLevel);

  const startedAt = Date.now();
  const configManager = createConfigManager({
    configFile: parsed.options.configFile,
    credentialsFile: parsed.options.credentialsFile
  });
  await withConsoleLogsOnStderr(() => configManager.loadConfig());

  const memory = process.memoryUsage();
  const configCheck = {
    status: HealthStatus.HEALTHY,
    message: '配置正常',
    timestamp: new Date().toISOString()
  };
  const ossCheck = await checkOSS(configManager.getOSSRuntimeConfig());
  const status = ossCheck.status === HealthStatus.HEALTHY ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY;
  const report = {
    status,
    timestamp: new Date().toISOString(),
    version: configManager.getMCPConfig().version,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    checks: {
      config: configCheck,
      oss: ossCheck,
      memory: {
        status: HealthStatus.HEALTHY,
        message: '内存使用正常',
        timestamp: new Date().toISOString(),
        details: {
          heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`
        }
      }
    }
  };

  return {
    command: 'health',
    data: { health: report },
    text: formatHealth(report),
    exitCode: status === HealthStatus.HEALTHY ? CliExitCode.SUCCESS : CliExitCode.RUNTIME_ERROR
  };
}

async function checkOSS(config: OSSConfigType) {
  const startedAt = Date.now();
  const storageConfig = toStorageConfig(config);

  try {
    const storage = new OSSStorageService(storageConfig, createCliLogger());
    const connected = await storage.checkConnection();
    return {
      status: connected ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
      message: connected ? 'OSS连接正常' : 'OSS连接失败',
      timestamp: new Date().toISOString(),
      duration: Date.now() - startedAt
    };
  } catch (error) {
    return {
      status: HealthStatus.UNHEALTHY,
      message: `OSS检查失败: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startedAt
    };
  }
}

function formatConfigSummary(summary: Record<string, unknown>): string {
  return `Config valid
Environment: ${String(summary.environment)}
OSS bucket: ${String((summary.oss as Record<string, unknown>).bucket)}
OSS region: ${String((summary.oss as Record<string, unknown>).region)}
MCP version: ${String((summary.mcp as Record<string, unknown>).version)}`;
}

function formatHealth(report: {
  status: HealthStatus;
  checks: {
    config: { status: HealthStatus };
    oss: { status: HealthStatus };
    memory: { status: HealthStatus };
  };
}): string {
  return `Health: ${report.status}
Config: ${report.checks.config.status}
OSS: ${report.checks.oss.status}
Memory: ${report.checks.memory.status}`;
}

function toStorageConfig(config: OSSConfigType): StorageConfig {
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

function readPackageVersion(): string {
  const packageUrl = new URL('../../../package.json', import.meta.url);
  const packageJson = JSON.parse(readFileSync(packageUrl, 'utf-8')) as { version?: string };
  return packageJson.version ?? '0.0.0';
}

function applyLogLevel(logLevel: string | undefined): void {
  if (!logLevel) {
    return;
  }

  if (!Object.values(LogLevel).includes(logLevel as LogLevel)) {
    throw new CliError(
      'INVALID_LOG_LEVEL',
      `不支持的日志级别: ${logLevel}`,
      CliExitCode.ARGUMENT_ERROR
    );
  }

  process.env.MCP_LOG_LEVEL = logLevel;
}

function createCliLogger() {
  return {
    debug: (_message: string, _data?: unknown) => undefined,
    info: (_message: string, _data?: unknown) => undefined,
    warn: (message: string) => process.stderr.write(`${message}\n`),
    error: (message: string) => process.stderr.write(`${message}\n`)
  };
}
