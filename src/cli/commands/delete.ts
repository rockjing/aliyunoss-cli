/**
 * aliyunoss-cli - 删除类 OSS 命令
 *
 * @fileoverview 实现 delete、delete-many，并加入二次确认、dry-run 和非 TTY 保护
 * @author aigroup-aliyunoss-mcp team
 * @version 1.0.0
 */

import { existsSync, readFileSync, statSync } from 'fs';

import { assertObjectKey } from '../../security/object-key.js';
import type { StorageService } from '../../storage/index.js';
import { ErrorCode, MCPError } from '../../types/index.js';
import { confirmDeletion, formatDeletePreview, type DeleteConfirmationRequest } from '../confirm.js';
import { CliError, CliExitCode } from '../errors.js';
import { createCliStorageRuntime, type CliStorageFactory } from '../storage.js';
import type { CliCommand, CliCommandContext, CliCommandResult, ParsedCliArgs } from '../types.js';

const MAX_DELETE_MANY_KEYS = 1000;

export interface DeleteCommandDependencies {
  createStorage?: CliStorageFactory;
  now?: () => Date;
  confirm?: (request: DeleteConfirmationRequest) => Promise<void>;
}

interface ResolvedDeleteCommandDependencies {
  createStorage: CliStorageFactory | undefined;
  now: () => Date;
  confirm: (request: DeleteConfirmationRequest) => Promise<void>;
}

export function createDeleteCommands(dependencies: DeleteCommandDependencies = {}): CliCommand[] {
  const deps: ResolvedDeleteCommandDependencies = {
    createStorage: dependencies.createStorage,
    now: dependencies.now ?? (() => new Date()),
    confirm: dependencies.confirm ?? confirmDeletion
  };

  return [
    {
      name: 'delete',
      summary: '删除单个 OSS 对象，默认需要二次确认',
      usage: 'aliyunoss-cli delete <object-key> [--yes] [--dry-run]',
      run: (context) => runDelete(context, deps)
    },
    {
      name: 'delete-many',
      summary: '按本地清单批量删除 OSS 对象，默认需要二次确认',
      usage: 'aliyunoss-cli delete-many --file <list-file> [--yes] [--dry-run]',
      run: (context) => runDeleteMany(context, deps)
    }
  ];
}

async function runDelete(
  { parsed }: CliCommandContext,
  deps: ResolvedDeleteCommandDependencies
): Promise<CliCommandResult> {
  ensureOnlyOptions(parsed, 'delete', []);
  const deleteArgs = requirePositionals(parsed, 'delete', 1);
  const key = assertObjectKey(deleteArgs[0] as string, 'object key');
  const runtime = await createCliStorageRuntime(parsed, deps.createStorage);
  const confirmationRequest = createConfirmationRequest(parsed, runtime.bucket, runtime.region, 'delete', [key]);

  await deps.confirm(confirmationRequest);

  if (parsed.options.dryRun) {
    return createDryRunResult('delete', confirmationRequest);
  }

  await runtime.storage.deleteFile(key);

  return {
    command: 'delete',
    data: {
      fileName: key,
      key,
      success: true,
      deleteTime: deps.now().toISOString()
    },
    text: `Delete success
Key: ${key}`
  };
}

async function runDeleteMany(
  { parsed }: CliCommandContext,
  deps: ResolvedDeleteCommandDependencies
): Promise<CliCommandResult> {
  ensureOnlyOptions(parsed, 'delete-many', ['--file']);
  requirePositionals(parsed, 'delete-many', 0);
  const keys = readDeleteList(requireStringOption(parsed, '--file', 'delete-many 需要 --file <list-file>'));
  const runtime = await createCliStorageRuntime(parsed, deps.createStorage);
  const confirmationRequest = createConfirmationRequest(parsed, runtime.bucket, runtime.region, 'delete-many', keys);

  await deps.confirm(confirmationRequest);

  if (parsed.options.dryRun) {
    return createDryRunResult('delete-many', confirmationRequest);
  }

  const deleteMultipleFiles = runtime.storage.deleteMultipleFiles;
  if (deleteMultipleFiles) {
    const batchResult = await deleteMultipleFiles.call(runtime.storage, keys);
    const deleted = (batchResult.deleted ?? []).map((item) => ({
      fileName: item.key,
      success: true
    }));
    const errors = (batchResult.errors ?? []).map((item) => ({
      fileName: item.key,
      error: `${item.code}: ${item.message}`
    }));

    return createDeleteManyResult(deleted, errors, keys.length);
  }

  const { deleted, errors } = await deleteOneByOne(runtime.storage, keys);
  return createDeleteManyResult(deleted, errors, keys.length);
}

function createConfirmationRequest(
  parsed: ParsedCliArgs,
  bucket: string,
  region: string,
  operation: 'delete' | 'delete-many',
  keys: string[]
): DeleteConfirmationRequest {
  return {
    operation,
    bucket,
    region,
    keys,
    yes: parsed.options.yes,
    dryRun: parsed.options.dryRun
  };
}

function createDryRunResult(command: 'delete' | 'delete-many', request: DeleteConfirmationRequest): CliCommandResult {
  const data = {
    dryRun: true,
    bucket: request.bucket,
    region: request.region,
    count: request.keys.length,
    keys: request.keys,
    samples: request.keys.slice(0, 10)
  };

  return {
    command,
    data,
    text: formatDeletePreview(request)
  };
}

function createDeleteManyResult(
  deleted: Array<{ fileName: string; success: boolean }>,
  errors: Array<{ fileName: string; error: string }>,
  total: number
): CliCommandResult {
  return {
    command: 'delete-many',
    data: {
      deleted,
      errors,
      total,
      successCount: deleted.length,
      errorCount: errors.length
    },
    text: `Delete many completed
Total: ${total}
Success: ${deleted.length}
Errors: ${errors.length}`
  };
}

async function deleteOneByOne(
  storage: StorageService,
  keys: string[]
): Promise<{
  deleted: Array<{ fileName: string; success: boolean }>;
  errors: Array<{ fileName: string; error: string }>;
}> {
  const deleted: Array<{ fileName: string; success: boolean }> = [];
  const errors: Array<{ fileName: string; error: string }> = [];

  for (const key of keys) {
    try {
      await storage.deleteFile(key);
      deleted.push({ fileName: key, success: true });
    } catch (error) {
      errors.push({
        fileName: key,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { deleted, errors };
}

function readDeleteList(filePath: string): string[] {
  if (!existsSync(filePath)) {
    throw new MCPError(ErrorCode.FILE_NOT_FOUND, `删除清单文件不存在: ${filePath}`, { filePath });
  }

  const stats = statSync(filePath);
  if (!stats.isFile()) {
    throw new MCPError(ErrorCode.VALIDATION_ERROR, `删除清单路径不是文件: ${filePath}`, { filePath });
  }

  const rawKeys = readFileSync(filePath, 'utf-8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const keys = Array.from(new Set(rawKeys)).map((key) => assertObjectKey(key, 'object key'));

  if (keys.length === 0) {
    throw new CliError('EMPTY_DELETE_LIST', '删除清单不能为空', CliExitCode.ARGUMENT_ERROR, { filePath });
  }

  if (keys.length > MAX_DELETE_MANY_KEYS) {
    throw new CliError(
      'TOO_MANY_DELETE_KEYS',
      `单次批量删除最多支持 ${MAX_DELETE_MANY_KEYS} 个 object key`,
      CliExitCode.ARGUMENT_ERROR,
      { count: keys.length, max: MAX_DELETE_MANY_KEYS }
    );
  }

  return keys;
}

function requirePositionals(parsed: ParsedCliArgs, commandName: string, expected: number): string[] {
  if (parsed.positionals.length !== expected) {
    throw new CliError(
      'INVALID_ARGUMENT_COUNT',
      `${commandName} 需要 ${expected} 个位置参数，当前收到 ${parsed.positionals.length} 个`,
      CliExitCode.ARGUMENT_ERROR
    );
  }

  return parsed.positionals;
}

function ensureOnlyOptions(parsed: ParsedCliArgs, commandName: string, allowed: string[]): void {
  const unexpected = Object.keys(parsed.commandOptions).filter((option) => !allowed.includes(option));
  if (unexpected.length > 0) {
    throw new CliError(
      'UNKNOWN_OPTION',
      `${commandName} 不支持参数: ${unexpected.join(', ')}`,
      CliExitCode.ARGUMENT_ERROR
    );
  }
}

function requireStringOption(parsed: ParsedCliArgs, optionName: string, message: string): string {
  const value = parsed.commandOptions[optionName];
  if (typeof value !== 'string' || value.length === 0) {
    throw new CliError('MISSING_OPTION', message, CliExitCode.ARGUMENT_ERROR);
  }
  return value;
}
