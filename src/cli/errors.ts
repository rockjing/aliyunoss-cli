/**
 * aliyunoss-cli - CLI错误定义
 *
 * @fileoverview 定义 CLI 统一错误、退出码和错误归一化能力
 * @author aigroup-aliyunoss-mcp team
 * @version 1.0.0
 */

import { ErrorCode, MCPError } from '../types/index.js';

export enum CliExitCode {
  SUCCESS = 0,
  RUNTIME_ERROR = 1,
  ARGUMENT_ERROR = 2,
  CANCELLED = 130
}

export class CliError extends Error {
  readonly code: string;
  readonly exitCode: CliExitCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: string,
    message: string,
    exitCode: CliExitCode = CliExitCode.RUNTIME_ERROR,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CliError';
    this.code = code;
    this.exitCode = exitCode;
    this.details = details;
  }
}

export interface NormalizedCliError {
  code: string;
  message: string;
  exitCode: CliExitCode;
  details?: Record<string, unknown>;
}

export function normalizeCliError(error: unknown): NormalizedCliError {
  if (error instanceof CliError) {
    return {
      code: error.code,
      message: error.message,
      exitCode: error.exitCode,
      ...(error.details ? { details: error.details } : {})
    };
  }

  if (error instanceof MCPError) {
    return {
      code: error.code,
      message: error.message,
      exitCode: mapMCPErrorToExitCode(error.code),
      ...(error.details ? { details: error.details } : {})
    };
  }

  if (error instanceof Error) {
    return {
      code: ErrorCode.INTERNAL_ERROR,
      message: error.message,
      exitCode: CliExitCode.RUNTIME_ERROR
    };
  }

  return {
    code: ErrorCode.INTERNAL_ERROR,
    message: String(error),
    exitCode: CliExitCode.RUNTIME_ERROR
  };
}

function mapMCPErrorToExitCode(code: ErrorCode): CliExitCode {
  if (code === ErrorCode.MCP_PARAMETER_INVALID || code === ErrorCode.VALIDATION_ERROR) {
    return CliExitCode.ARGUMENT_ERROR;
  }

  return CliExitCode.RUNTIME_ERROR;
}
