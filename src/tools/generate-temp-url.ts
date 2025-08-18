/**
 * 阿里云OSS MCP服务 - 临时URL生成工具
 * 
 * @fileoverview 生成临时访问链接的MCP工具实现
 * @author alioss-mcp team
 * @version 1.0.0
 */

import {
  ToolDefinition,
  ToolContext,
  GetObjectUrlArgs,
  GetObjectUrlResult,
  MCPError,
  ErrorCode,
  ToolHandler
} from '../types/index.js';

/**
 * 临时URL生成工具处理函数
 */
async function generateTempUrlHandler(
  args: GetObjectUrlArgs,
  context: ToolContext
): Promise<GetObjectUrlResult> {
  const { fileName, expires = 3600, method = 'GET' } = args;
  const { logger, storage, traceId } = context;
  
  try {
    logger?.info('开始生成临时URL', {
      fileName,
      expires,
      method,
      traceId
    });

    // 验证文件名
    if (!isValidFileName(fileName)) {
      throw new MCPError(
        ErrorCode.VALIDATION_ERROR,
        `无效的文件名: ${fileName}`,
        { fileName, traceId }
      );
    }

    // 验证过期时间
    if (expires < 1 || expires > 604800) { // 最大7天
      throw new MCPError(
        ErrorCode.VALIDATION_ERROR,
        `过期时间必须在1秒到7天之间: ${expires}`,
        { fileName, expires, traceId }
      );
    }

    // 检查文件是否存在（可选，对于PUT方法不需要检查）
    if (method === 'GET') {
      try {
        await storage.getFileMetadata(fileName);
      } catch (error) {
        if (error instanceof MCPError && error.code === ErrorCode.FILE_NOT_FOUND) {
          throw new MCPError(
            ErrorCode.FILE_NOT_FOUND,
            `文件不存在: ${fileName}`,
            { fileName, traceId }
          );
        }
        // 其他错误继续执行，可能是权限问题但文件存在
        logger?.warn('检查文件存在性时出错，继续生成URL', {
          fileName,
          error: error instanceof Error ? error.message : String(error),
          traceId
        });
      }
    }

    // 生成临时URL
    const startTime = Date.now();
    const url = await storage.generateTempUrl(fileName, expires);
    const duration = Date.now() - startTime;

    // 计算过期时间戳
    const expiresAt = new Date(Date.now() + expires * 1000);

    const result: GetObjectUrlResult = {
      url,
      fileName,
      expires,
      expiresAt: expiresAt.toISOString(),
      method
    };

    logger?.info('临时URL生成成功', {
      fileName,
      expires,
      method,
      expiresAt: expiresAt.toISOString(),
      duration,
      traceId
    });

    return result;

  } catch (error) {
    logger?.error('临时URL生成失败', {
      fileName,
      expires,
      method,
      error: error instanceof Error ? error.message : String(error),
      traceId
    });

    if (error instanceof MCPError) {
      throw error;
    }

    throw new MCPError(
      ErrorCode.OSS_CONNECTION_ERROR,
      `临时URL生成失败: ${error instanceof Error ? error.message : String(error)}`,
      { fileName, expires, method, traceId, error }
    );
  }
}

/**
 * 验证文件名是否合法
 */
function isValidFileName(fileName: string): boolean {
  // 检查是否为空或只包含空白字符
  if (!fileName.trim()) {
    return false;
  }

  // 检查长度
  if (fileName.length > 1023) { // OSS对象名最大长度
    return false;
  }

  // 检查是否包含非法字符（根据OSS规范）
  const illegalChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
  if (illegalChars.test(fileName)) {
    return false;
  }

  // 检查是否以/开头（OSS不允许）
  if (fileName.startsWith('/')) {
    return false;
  }

  // 检查是否包含连续的斜杠
  if (fileName.includes('//')) {
    return false;
  }

  // 检查是否以.开头的隐藏文件（在某些情况下可能有问题）
  const pathParts = fileName.split('/');
  for (const part of pathParts) {
    if (part === '.' || part === '..') {
      return false;
    }
  }

  return true;
}

/**
 * 临时URL生成工具定义
 */
export const generateTempUrlTool: ToolDefinition = {
  name: 'getObjectUrl',
  description: '生成阿里云OSS文件的临时访问URL',
  inputSchema: {
    type: 'object',
    properties: {
      fileName: {
        type: 'string',
        description: '文件名（包含路径）'
      },
      expires: {
        type: 'number',
        description: 'URL有效期（秒），默认3600秒（1小时），最大604800秒（7天）',
        minimum: 1,
        maximum: 604800,
        default: 3600
      },
      method: {
        type: 'string',
        enum: ['GET', 'PUT', 'POST', 'DELETE'],
        description: 'HTTP方法，默认GET',
        default: 'GET'
      }
    },
    required: ['fileName'],
    additionalProperties: false
  },
  handler: generateTempUrlHandler as ToolHandler<GetObjectUrlArgs, GetObjectUrlResult>
};