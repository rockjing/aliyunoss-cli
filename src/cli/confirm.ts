/**
 * aliyunoss-cli - 危险操作确认
 *
 * @fileoverview 删除类命令的预览、TTY 保护和二次确认逻辑
 * @author aigroup-aliyunoss-mcp team
 * @version 1.0.0
 */

import { stdin, stderr } from 'process';
import { createInterface } from 'readline/promises';

import { CliError, CliExitCode } from './errors.js';

export interface DeleteConfirmationRequest {
  operation: 'delete' | 'delete-many';
  bucket: string;
  region: string;
  keys: string[];
  yes: boolean;
  dryRun: boolean;
  sampleSize?: number;
}

export interface DeleteConfirmationIO {
  isTTY: boolean;
  write(message: string): void;
  question(prompt: string): Promise<string>;
}

const DEFAULT_SAMPLE_SIZE = 10;
const CONFIRM_WORD = 'YES';

export async function confirmDeletion(
  request: DeleteConfirmationRequest,
  io: DeleteConfirmationIO = createNodeConfirmationIO()
): Promise<void> {
  if (request.dryRun || request.yes) {
    return;
  }

  io.write(formatDeletePreview(request));

  if (!io.isTTY) {
    throw new CliError(
      'CONFIRMATION_REQUIRED',
      '非交互式终端执行删除命令时必须显式传入 --yes 或使用 --dry-run',
      CliExitCode.ARGUMENT_ERROR
    );
  }

  const answer = (await io.question(getConfirmPrompt(request))).trim();
  if (isConfirmed(answer, request.keys)) {
    return;
  }

  throw new CliError(
    'USER_CANCELLED',
    '删除操作已取消',
    CliExitCode.CANCELLED,
    { operation: request.operation, count: request.keys.length }
  );
}

export function formatDeletePreview(request: DeleteConfirmationRequest): string {
  const sampleSize = request.sampleSize ?? DEFAULT_SAMPLE_SIZE;
  const sample = request.keys.slice(0, sampleSize);
  const lines = [
    request.dryRun ? 'Delete dry run' : 'Delete confirmation required',
    `Operation: ${request.operation}`,
    `Bucket: ${request.bucket}`,
    `Region: ${request.region}`,
    `Count: ${request.keys.length}`,
    'Objects:'
  ];

  for (const key of sample) {
    lines.push(`  - ${key}`);
  }

  if (request.keys.length > sample.length) {
    lines.push(`  ... and ${request.keys.length - sample.length} more`);
  }

  return `${lines.join('\n')}\n`;
}

function createNodeConfirmationIO(): DeleteConfirmationIO {
  const readline = createInterface({ input: stdin, output: stderr });

  return {
    isTTY: Boolean(stdin.isTTY),
    write: (message: string) => stderr.write(message),
    question: async (prompt: string) => {
      try {
        return await readline.question(prompt);
      } finally {
        readline.close();
      }
    }
  };
}

function getConfirmPrompt(request: DeleteConfirmationRequest): string {
  if (request.keys.length === 1) {
    return `请输入完整 object key 或 ${CONFIRM_WORD} 确认删除: `;
  }

  return `请输入 ${CONFIRM_WORD} 确认批量删除 ${request.keys.length} 个对象: `;
}

function isConfirmed(answer: string, keys: string[]): boolean {
  if (answer === CONFIRM_WORD) {
    return true;
  }

  return keys.length === 1 && answer === keys[0];
}
