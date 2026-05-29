/**
 * aliyunoss-cli - 输出格式化
 *
 * @fileoverview 统一处理普通文本和 JSON 输出，保持 stdout/stderr 分离
 * @author aigroup-aliyunoss-mcp team
 * @version 1.0.0
 */

import { redactSensitiveDetails } from '../security/redaction.js';
import type { NormalizedCliError } from './errors.js';
import type { CliCommandResult } from './types.js';

export function writeSuccess(result: CliCommandResult, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify({
      success: true,
      command: result.command,
      data: redactSensitiveDetails(result.data)
    }, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${result.text ?? formatTextData(result.data)}\n`);
}

export function writeError(command: string | null, error: NormalizedCliError, json: boolean): void {
  if (json) {
    process.stderr.write(`${JSON.stringify({
      success: false,
      command: command ?? 'unknown',
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: redactSensitiveDetails(error.details) } : {})
      }
    }, null, 2)}\n`);
    return;
  }

  process.stderr.write(`Error: ${error.message}\n`);
}

function formatTextData(data: Record<string, unknown>): string {
  return Object.entries(data)
    .map(([key, value]) => `${key}: ${formatTextValue(value)}`)
    .join('\n');
}

function formatTextValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(redactSensitiveDetails(value));
}
