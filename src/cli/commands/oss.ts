/**
 * aliyunoss-cli - 非删除类 OSS 命令
 *
 * @fileoverview 实现 upload、url、list、copy、symlink、meta 子命令
 * @author aigroup-aliyunoss-mcp team
 * @version 1.0.0
 */

import { existsSync, readFileSync, statSync } from 'fs';
import { extname } from 'path';

import { assertObjectKey, assertObjectPrefix } from '../../security/object-key.js';
import type {
  FileListResult,
  FileMetadata,
  ListFilesOptions,
  StorageClass,
  StorageService,
  UploadOptions,
} from '../../storage/index.js';
import { ErrorCode, MCPError } from '../../types/index.js';
import { CliError, CliExitCode } from '../errors.js';
import { createCliStorageRuntime, type CliStorageFactory } from '../storage.js';
import type { CliCommand, CliCommandContext, CliCommandResult, ParsedCliArgs } from '../types.js';

const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;
const DEFAULT_URL_EXPIRES = 3600;
const MAX_URL_EXPIRES = 604800;
const DEFAULT_LIST_MAX_KEYS = 100;
const MAX_LIST_MAX_KEYS = 1000;

export interface OssCommandDependencies {
  createStorage?: CliStorageFactory;
  now?: () => Date;
}

interface ResolvedOssCommandDependencies {
  createStorage: CliStorageFactory | undefined;
  now: () => Date;
}

export function createOssCommands(dependencies: OssCommandDependencies = {}): CliCommand[] {
  const deps: ResolvedOssCommandDependencies = {
    now: dependencies.now ?? (() => new Date()),
    createStorage: dependencies.createStorage,
  };

  return [
    {
      name: 'upload',
      summary: '上传本地文件到 OSS',
      usage: 'aliyunoss-cli upload <local-file> --key <object-key> [--content-type <type>]',
      run: (context) => runUpload(context, deps),
    },
    {
      name: 'url',
      summary: '生成对象临时访问 URL',
      usage: 'aliyunoss-cli url <object-key> [--expires <seconds>]',
      run: (context) => runUrl(context, deps),
    },
    {
      name: 'list',
      summary: '按前缀列出 OSS 对象',
      usage: 'aliyunoss-cli list [--prefix <prefix>] [--max-keys <n>]',
      run: (context) => runList(context, deps),
    },
    {
      name: 'copy',
      summary: '复制 OSS 对象',
      usage: 'aliyunoss-cli copy <source-key> <target-key> [--no-overwrite]',
      run: (context) => runCopy(context, deps),
    },
    {
      name: 'symlink',
      aliases: ['put-symlink'],
      summary: '创建 OSS 软链接',
      usage: 'aliyunoss-cli symlink <target-key> <symlink-key> [--no-overwrite]',
      run: (context) => runSymlink(context, deps),
    },
    {
      name: 'meta',
      summary: '查询 OSS 对象元数据',
      usage: 'aliyunoss-cli meta <object-key>',
      run: (context) => runMeta(context, deps),
    },
  ];
}

async function runUpload(
  { parsed }: CliCommandContext,
  deps: ResolvedOssCommandDependencies
): Promise<CliCommandResult> {
  ensureOnlyOptions(parsed, 'upload', ['--key', '--content-type', '--storage-class']);
  const uploadArgs = requirePositionals(parsed, 'upload', 1);
  const localFile = uploadArgs[0] as string;
  const key = assertObjectKey(
    requireStringOption(parsed, '--key', 'upload 需要 --key <object-key>'),
    'object key'
  );
  const file = readLocalFile(localFile);
  const contentType =
    getStringOption(parsed, '--content-type') ?? getContentTypeFromExtension(extname(localFile));
  const storageClass = getStringOption(parsed, '--storage-class');
  const runtime = await createCliStorageRuntime(parsed, deps.createStorage);
  const uploadOptions: UploadOptions = { contentType };

  if (storageClass) {
    uploadOptions.storageClass = storageClass as StorageClass;
  }

  const uploadedKey = await runtime.storage.uploadFile(file.content, key, uploadOptions);
  const url = await runtime.storage.generateTempUrl(uploadedKey, DEFAULT_URL_EXPIRES);
  const data = {
    fileName: uploadedKey,
    key: uploadedKey,
    url,
    size: file.size,
    contentType,
    storageClass: storageClass ?? 'Standard',
    uploadTime: deps.now().toISOString(),
  };

  return {
    command: 'upload',
    data,
    text: `Upload success
Key: ${uploadedKey}
Size: ${file.size}
Content-Type: ${contentType}
URL: ${url}`,
  };
}

async function runUrl(
  { parsed }: CliCommandContext,
  deps: ResolvedOssCommandDependencies
): Promise<CliCommandResult> {
  ensureOnlyOptions(parsed, 'url', ['--expires']);
  const urlArgs = requirePositionals(parsed, 'url', 1);
  const rawKey = urlArgs[0] as string;
  const key = assertObjectKey(rawKey, 'object key');
  const expires = getIntegerOption(parsed, '--expires', DEFAULT_URL_EXPIRES);

  if (expires < 1 || expires > MAX_URL_EXPIRES) {
    throw new CliError(
      'INVALID_EXPIRES',
      `--expires 必须在 1 到 ${MAX_URL_EXPIRES} 秒之间`,
      CliExitCode.ARGUMENT_ERROR
    );
  }

  const runtime = await createCliStorageRuntime(parsed, deps.createStorage);
  if (runtime.storage.getFileMetadata) {
    await runtime.storage.getFileMetadata(key);
  }

  const url = await runtime.storage.generateTempUrl(key, expires);
  const expiresAt = new Date(deps.now().getTime() + expires * 1000).toISOString();
  const data = { url, fileName: key, key, expires, expiresAt, method: 'GET' };

  return {
    command: 'url',
    data,
    text: `Temporary URL
Key: ${key}
Expires: ${expires}
Expires At: ${expiresAt}
URL: ${url}`,
  };
}

async function runList(
  { parsed }: CliCommandContext,
  deps: ResolvedOssCommandDependencies
): Promise<CliCommandResult> {
  ensureOnlyOptions(parsed, 'list', ['--prefix', '--max-keys', '--marker', '--delimiter']);
  requirePositionals(parsed, 'list', 0);
  const prefix = assertObjectPrefix(getStringOption(parsed, '--prefix') ?? '', 'object prefix');
  const maxKeys = getIntegerOption(parsed, '--max-keys', DEFAULT_LIST_MAX_KEYS);

  if (maxKeys < 1 || maxKeys > MAX_LIST_MAX_KEYS) {
    throw new CliError(
      'INVALID_MAX_KEYS',
      `--max-keys 必须在 1 到 ${MAX_LIST_MAX_KEYS} 之间`,
      CliExitCode.ARGUMENT_ERROR
    );
  }

  const runtime = await createCliStorageRuntime(parsed, deps.createStorage);
  const listFiles = requireStorageMethod(runtime.storage, 'listFiles');
  const options: ListFilesOptions = { prefix, maxKeys };
  const marker = getStringOption(parsed, '--marker');
  const delimiter = getStringOption(parsed, '--delimiter');

  if (marker) {
    options.marker = marker;
  }

  if (delimiter) {
    options.delimiter = delimiter;
  }

  const result = await listFiles.call(runtime.storage, options);
  const data = normalizeListResult(result);

  return {
    command: 'list',
    data,
    text: formatListText(data),
  };
}

async function runCopy(
  { parsed }: CliCommandContext,
  deps: ResolvedOssCommandDependencies
): Promise<CliCommandResult> {
  ensureOnlyOptions(parsed, 'copy', ['--no-overwrite']);
  const copyArgs = requirePositionals(parsed, 'copy', 2);
  const rawSource = copyArgs[0] as string;
  const rawTarget = copyArgs[1] as string;
  const source = assertObjectKey(rawSource, 'source object key');
  const target = assertObjectKey(rawTarget, 'target object key');

  if (source === target) {
    throw new CliError(
      'SAME_SOURCE_TARGET',
      '源对象和目标对象不能相同',
      CliExitCode.ARGUMENT_ERROR
    );
  }

  const runtime = await createCliStorageRuntime(parsed, deps.createStorage);
  const copyFile = requireStorageMethod(runtime.storage, 'copyFile');
  const getFileMetadata = requireStorageMethod(runtime.storage, 'getFileMetadata');
  const overwrite = !getBooleanOption(parsed, '--no-overwrite');
  const sourceMetadata = await getFileMetadata.call(runtime.storage, source);

  if (!overwrite) {
    await assertTargetCanBeWritten(runtime.storage, target);
  }

  await copyFile.call(runtime.storage, source, target);

  let targetMetadata: FileMetadata | undefined;
  try {
    targetMetadata = await getFileMetadata.call(runtime.storage, target);
  } catch {
    targetMetadata = undefined;
  }

  const data = {
    source,
    target,
    success: true,
    overwrite,
    sourceSize: sourceMetadata.size,
    etag: targetMetadata?.etag ?? '',
    copyTime: deps.now().toISOString(),
  };

  return {
    command: 'copy',
    data,
    text: `Copy success
Source: ${source}
Target: ${target}
Overwrite: ${overwrite ? 'yes' : 'no'}`,
  };
}

async function runSymlink(
  { parsed }: CliCommandContext,
  deps: ResolvedOssCommandDependencies
): Promise<CliCommandResult> {
  ensureOnlyOptions(parsed, 'symlink', ['--no-overwrite', '--storage-class']);
  const symlinkArgs = requirePositionals(parsed, 'symlink', 2);
  const rawTarget = symlinkArgs[0] as string;
  const rawSymlink = symlinkArgs[1] as string;
  const target = assertObjectKey(rawTarget, 'target object key', { allowAbsolute: true });
  const symlink = assertObjectKey(rawSymlink, 'symlink object key', { allowAbsolute: true });

  if (target === symlink) {
    throw new CliError(
      'SAME_TARGET_SYMLINK',
      '软链接路径不能与目标对象相同',
      CliExitCode.ARGUMENT_ERROR
    );
  }

  const runtime = await createCliStorageRuntime(parsed, deps.createStorage);
  const createSymlink = requireStorageMethod(runtime.storage, 'createSymlink');
  const overwrite = !getBooleanOption(parsed, '--no-overwrite');
  const storageClass = getStringOption(parsed, '--storage-class');
  const result = await createSymlink.call(runtime.storage, target, symlink, {
    forbidOverwrite: !overwrite,
    ...(storageClass ? { storageClass: storageClass as StorageClass } : {}),
  });
  const data = {
    target: result.target,
    symlink: result.symlink,
    symlinkPath: `/${result.symlink}`,
    success: true,
    overwrite,
    storageClass: storageClass ?? 'Standard',
    ...(result.requestId ? { requestId: result.requestId } : {}),
    ...(result.versionId ? { versionId: result.versionId } : {}),
    createTime: deps.now().toISOString(),
  };

  return {
    command: 'symlink',
    data,
    text: `Symlink created
Target: ${result.target}
Symlink: /${result.symlink}
Overwrite: ${overwrite ? 'yes' : 'no'}`,
  };
}

async function runMeta(
  { parsed }: CliCommandContext,
  deps: ResolvedOssCommandDependencies
): Promise<CliCommandResult> {
  ensureOnlyOptions(parsed, 'meta', []);
  const metaArgs = requirePositionals(parsed, 'meta', 1);
  const rawKey = metaArgs[0] as string;
  const key = assertObjectKey(rawKey, 'object key');
  const runtime = await createCliStorageRuntime(parsed, deps.createStorage);
  const getFileMetadata = requireStorageMethod(runtime.storage, 'getFileMetadata');
  const metadata = await getFileMetadata.call(runtime.storage, key);
  const data = {
    fileName: metadata.name,
    key: metadata.name,
    size: metadata.size,
    lastModified: metadata.lastModified.toISOString(),
    contentType: metadata.contentType,
    etag: metadata.etag,
    storageClass: metadata.storageClass ?? 'Standard',
    metadata: metadata.metadata ?? {},
    ...(metadata.versionId ? { versionId: metadata.versionId } : {}),
  };

  return {
    command: 'meta',
    data,
    text: `Object metadata
Key: ${metadata.name}
Size: ${metadata.size}
Content-Type: ${metadata.contentType}
ETag: ${metadata.etag}
Last Modified: ${metadata.lastModified.toISOString()}`,
  };
}

function readLocalFile(filePath: string): { content: Buffer; size: number } {
  if (!existsSync(filePath)) {
    throw new MCPError(ErrorCode.FILE_NOT_FOUND, `文件不存在: ${filePath}`, { filePath });
  }

  const stats = statSync(filePath);
  if (!stats.isFile()) {
    throw new MCPError(ErrorCode.VALIDATION_ERROR, `路径不是文件: ${filePath}`, { filePath });
  }

  if (stats.size > MAX_UPLOAD_SIZE) {
    throw new MCPError(
      ErrorCode.FILE_TOO_LARGE,
      `文件太大: ${Math.round(stats.size / 1024 / 1024)}MB，最大允许100MB`,
      { filePath, fileSize: stats.size, maxFileSize: MAX_UPLOAD_SIZE }
    );
  }

  return {
    content: readFileSync(filePath),
    size: stats.size,
  };
}

async function assertTargetCanBeWritten(storage: StorageService, target: string): Promise<void> {
  const getFileMetadata = requireStorageMethod(storage, 'getFileMetadata');
  try {
    await getFileMetadata.call(storage, target);
  } catch (error) {
    if (error instanceof MCPError && error.code === ErrorCode.FILE_NOT_FOUND) {
      return;
    }
    throw error;
  }

  throw new CliError(
    'TARGET_EXISTS',
    `目标对象已存在且不允许覆盖: ${target}`,
    CliExitCode.ARGUMENT_ERROR,
    { target }
  );
}

function normalizeListResult(result: FileListResult) {
  const objects = result.objects.map((object) => ({
    name: object.name,
    size: object.size,
    lastModified: object.lastModified.toISOString(),
    etag: object.etag,
    storageClass: object.storageClass ?? 'Standard',
    contentType: getContentTypeFromExtension(extname(object.name)),
  }));

  return {
    objects,
    prefixes: result.prefixes ?? [],
    nextMarker: result.nextMarker,
    isTruncated: result.isTruncated,
    count: objects.length,
  };
}

function formatListText(data: ReturnType<typeof normalizeListResult>): string {
  const lines = [`Objects: ${data.count}`, `Truncated: ${data.isTruncated ? 'yes' : 'no'}`];

  if (data.nextMarker) {
    lines.push(`Next Marker: ${data.nextMarker}`);
  }

  for (const object of data.objects) {
    lines.push(`${object.name}\t${object.size}\t${object.lastModified}`);
  }

  if (data.prefixes.length > 0) {
    lines.push(`Prefixes: ${data.prefixes.join(', ')}`);
  }

  return lines.join('\n');
}

function requirePositionals(
  parsed: ParsedCliArgs,
  commandName: string,
  expected: number
): string[] {
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
  const unexpected = Object.keys(parsed.commandOptions).filter(
    (option) => !allowed.includes(option)
  );
  if (unexpected.length > 0) {
    throw new CliError(
      'UNKNOWN_OPTION',
      `${commandName} 不支持参数: ${unexpected.join(', ')}`,
      CliExitCode.ARGUMENT_ERROR
    );
  }
}

function requireStringOption(parsed: ParsedCliArgs, optionName: string, message: string): string {
  const value = getStringOption(parsed, optionName);
  if (!value) {
    throw new CliError('MISSING_OPTION', message, CliExitCode.ARGUMENT_ERROR);
  }
  return value;
}

function getStringOption(parsed: ParsedCliArgs, optionName: string): string | undefined {
  const value = parsed.commandOptions[optionName];
  return typeof value === 'string' ? value : undefined;
}

function getBooleanOption(parsed: ParsedCliArgs, optionName: string): boolean {
  return parsed.commandOptions[optionName] === true;
}

function getIntegerOption(parsed: ParsedCliArgs, optionName: string, defaultValue: number): number {
  const rawValue = getStringOption(parsed, optionName);
  if (rawValue === undefined) {
    return defaultValue;
  }

  const value = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(value) || String(value) !== rawValue) {
    throw new CliError('INVALID_NUMBER', `${optionName} 需要整数值`, CliExitCode.ARGUMENT_ERROR, {
      optionName,
      value: rawValue,
    });
  }

  return value;
}

function requireStorageMethod<K extends keyof StorageService>(
  storage: StorageService,
  methodName: K
): NonNullable<StorageService[K]> {
  const method = storage[methodName];
  if (typeof method !== 'function') {
    throw new CliError(
      'UNSUPPORTED_STORAGE_METHOD',
      `当前存储服务不支持 ${String(methodName)} 操作`,
      CliExitCode.RUNTIME_ERROR
    );
  }

  return method as NonNullable<StorageService[K]>;
}

function getContentTypeFromExtension(ext: string): string {
  const contentTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.zip': 'application/zip',
  };

  return contentTypes[ext.toLowerCase()] ?? 'application/octet-stream';
}
