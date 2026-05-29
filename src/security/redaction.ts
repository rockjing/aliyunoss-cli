/**
 * 阿里云OSS MCP服务 - 敏感信息脱敏工具
 *
 * @fileoverview 提供日志、错误详情、公开配置中的敏感字段脱敏能力
 * @author aigroup-aliyunoss-mcp team
 * @version 1.0.0
 */

export const REDACTED_VALUE = '***';

const SECRET_KEY_PATTERN = /(secret|password|token|privatekey|private_key|credential)/i;
const IDENTIFIER_KEY_PATTERN = /(accesskeyid|access_key_id|keyid|key_id)$/i;

/**
 * 对凭据标识做保留前后缀的掩码，便于排障但不泄露完整值。
 */
export function maskCredential(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    return '';
  }

  if (value.length <= 8) {
    return REDACTED_VALUE;
  }

  return `${value.slice(0, 4)}${REDACTED_VALUE}${value.slice(-4)}`;
}

/**
 * 递归脱敏对象、数组和日志详情中的敏感字段。
 */
export function redactSensitiveDetails<T>(value: T): T {
  return redactValue(value) as T;
}

function redactValue(value: unknown, key?: string): unknown {
  if (key && SECRET_KEY_PATTERN.test(key)) {
    return isEmptyString(value) ? '' : REDACTED_VALUE;
  }

  if (key && IDENTIFIER_KEY_PATTERN.test(key)) {
    return maskCredential(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value instanceof Error) {
    return redactError(value);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactValue(entryValue, entryKey)
      ])
    );
  }

  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && value.constructor === Object;
}

function isEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.length === 0;
}

function redactError(value: Error): Record<string, unknown> {
  const errorWithMeta = value as Error & {
    code?: unknown;
    details?: unknown;
    timestamp?: unknown;
  };

  const result: Record<string, unknown> = {
    name: value.name,
    message: value.message
  };

  if (errorWithMeta.code) {
    result.code = errorWithMeta.code;
  }

  if (errorWithMeta.details) {
    result.details = redactValue(errorWithMeta.details, 'details');
  }

  if (errorWithMeta.timestamp) {
    result.timestamp = errorWithMeta.timestamp;
  }

  return result;
}
