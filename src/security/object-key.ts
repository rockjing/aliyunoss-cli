/**
 * OSS object key security validation.
 *
 * @fileoverview Centralized validation for object keys and prefixes.
 */

import { ErrorCode, MCPError } from '../types/index.js';

const MAX_OBJECT_KEY_LENGTH = 1023;
const MAX_DECODE_PASSES = 3;

export interface ObjectKeyValidationOptions {
  allowEmpty?: boolean;
  allowedPrefix?: string;
  allowAbsolute?: boolean;
}

export interface ObjectKeyValidationResult {
  valid: boolean;
  normalizedKey?: string;
  reason?: string;
}

export function validateObjectKey(
  value: string,
  options: ObjectKeyValidationOptions = {}
): ObjectKeyValidationResult {
  return validatePathValue(value, options);
}

export function validateObjectPrefix(
  value: string,
  options: ObjectKeyValidationOptions = {}
): ObjectKeyValidationResult {
  return validatePathValue(value, { allowEmpty: true, ...options });
}

export function assertObjectKey(
  value: string,
  label = 'object key',
  options: ObjectKeyValidationOptions = {}
): string {
  const result = validateObjectKey(value, options);
  if (!result.valid || !result.normalizedKey) {
    throw new MCPError(
      ErrorCode.VALIDATION_ERROR,
      `无效的${label}: ${value}${result.reason ? `（${result.reason}）` : ''}`,
      { value, reason: result.reason }
    );
  }
  return result.normalizedKey;
}

export function assertObjectPrefix(
  value: string,
  label = 'object prefix',
  options: ObjectKeyValidationOptions = {}
): string {
  const result = validateObjectPrefix(value, options);
  if (!result.valid || result.normalizedKey === undefined) {
    throw new MCPError(
      ErrorCode.VALIDATION_ERROR,
      `无效的${label}: ${value}${result.reason ? `（${result.reason}）` : ''}`,
      { value, reason: result.reason }
    );
  }
  return result.normalizedKey;
}

function validatePathValue(
  value: string,
  options: ObjectKeyValidationOptions
): ObjectKeyValidationResult {
  const allowEmpty = options.allowEmpty ?? false;
  let key = value.trim();
  const configuredAllowedPrefix = options.allowedPrefix ?? process.env.OSS_KEY_PREFIX;
  const allowedPrefix = configuredAllowedPrefix?.trim();

  if (!key) {
    return allowEmpty ? valid(allowedPrefix || key) : invalid('不能为空');
  }

  const normalizedAbsolutePath = normalizeAbsolutePath(
    key,
    options.allowAbsolute ?? false,
    allowEmpty
  );
  if (!normalizedAbsolutePath.valid) {
    return normalizedAbsolutePath;
  }
  key = normalizedAbsolutePath.normalizedKey ?? key;

  const rawCheck = checkSingleValue(key);
  if (!rawCheck.valid) {
    return rawCheck;
  }

  let decoded = key;
  for (let pass = 0; pass < MAX_DECODE_PASSES; pass += 1) {
    const decodeResult = decodeOnce(decoded);
    if (!decodeResult.valid) {
      return decodeResult;
    }

    const decodedKey = decodeResult.normalizedKey;
    if (decodedKey === undefined) {
      return invalid('URL 编码结果无效');
    }

    if (decodedKey === decoded) {
      break;
    }

    decoded = decodedKey;
    const decodedCheck = checkSingleValue(decoded);
    if (!decodedCheck.valid) {
      return decodedCheck;
    }

    if (pass === MAX_DECODE_PASSES - 1) {
      return invalid('URL 编码层级过深');
    }
  }

  if (allowedPrefix && !key.startsWith(allowedPrefix)) {
    return invalid(`必须位于允许前缀 ${allowedPrefix} 下`);
  }

  return valid(key);
}

function normalizeAbsolutePath(
  value: string,
  allowAbsolute: boolean,
  allowEmpty: boolean
): ObjectKeyValidationResult {
  if (!allowAbsolute || !value.startsWith('/')) {
    return valid(value);
  }

  if (value.startsWith('//')) {
    return invalid('绝对路径只能包含一个前导 /');
  }

  const normalized = value.slice(1);
  if (!normalized && !allowEmpty) {
    return invalid('不能为空');
  }

  return valid(normalized);
}

function checkSingleValue(value: string): ObjectKeyValidationResult {
  if (value.length > MAX_OBJECT_KEY_LENGTH) {
    return invalid(`长度不能超过 ${MAX_OBJECT_KEY_LENGTH} 字符`);
  }

  if (hasControlChars(value)) {
    return invalid('不能包含控制字符');
  }

  if (value.startsWith('/')) {
    return invalid('不能以 / 开头');
  }

  if (value.includes('\\')) {
    return invalid('不能包含反斜杠');
  }

  if (value.includes('//')) {
    return invalid('不能包含连续斜杠');
  }

  const parts = value.split('/');
  if (parts.some((part) => part === '.' || part === '..')) {
    return invalid('不能包含 . 或 .. 路径段');
  }

  return valid(value);
}

function hasControlChars(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }

  return false;
}

function decodeOnce(value: string): ObjectKeyValidationResult {
  if (!value.includes('%')) {
    return valid(value);
  }

  try {
    return valid(decodeURIComponent(value));
  } catch {
    return invalid('URL 编码格式无效');
  }
}

function valid(normalizedKey: string): ObjectKeyValidationResult {
  return { valid: true, normalizedKey };
}

function invalid(reason: string): ObjectKeyValidationResult {
  return { valid: false, reason };
}
