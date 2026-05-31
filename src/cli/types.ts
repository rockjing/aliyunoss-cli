/**
 * aliyunoss-cli - CLI类型定义
 *
 * @fileoverview 定义命令解析、命令上下文和执行结果类型
 * @author aigroup-aliyunoss-mcp team
 * @version 1.0.0
 */

import type { CliExitCode } from './errors.js';

export interface CliOptions {
  json: boolean;
  help: boolean;
  version: boolean;
  stdio: boolean;
  validateConfig: boolean;
  health: boolean;
  yes: boolean;
  dryRun: boolean;
  configFile?: string;
  credentialsFile?: string;
  profile?: string;
  logLevel?: string;
}

export interface ParsedCliArgs {
  command: string | null;
  positionals: string[];
  options: CliOptions;
  commandOptions: Record<string, string | boolean>;
  rawArgs: string[];
}

export interface CliCommandContext {
  parsed: ParsedCliArgs;
}

export interface CliCommandResult {
  command: string;
  data: Record<string, unknown>;
  text?: string;
  exitCode?: CliExitCode;
}

export interface CliCommand {
  name: string;
  summary: string;
  usage: string;
  aliases?: string[];
  run(context: CliCommandContext): Promise<CliCommandResult>;
}
