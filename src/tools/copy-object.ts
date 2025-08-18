/**
 * 阿里云OSS MCP服务 - 文件复制工具
 * 
 * @fileoverview 复制文件的MCP工具实现
 * @author aigroup-aliyunoss-mcp team
 * @version 1.0.0
 */

import {
  ToolDefinition,
  ToolContext,
  CopyObjectArgs,
  CopyObjectResult,
  MCPError,
  ErrorCode,
  ToolHandler
} from '../types/index.js';

/**
 * 文件复制工具处理函数
 */
async function copyObjectHandler(
  args: CopyObjectArgs,
  context: ToolContext
): Promise<CopyObjectResult> {
  const { source, target, overwrite = true } = args;
  const { logger, storage, traceId } = context;
  
  try {
    logger?.info('开始复制文件', {
      source,
      target,
      overwrite,
      traceId
    });

    // 验证文件路径
    if (!isValidFileName(source)) {
      throw new MCPError(
        ErrorCode.VALIDATION_ERROR,
        `无效的源文件路径: ${source}`,
        { source, traceId }
      );
    }

    if (!isValidFileName(target)) {
      throw new MCPError(
        ErrorCode.VALIDATION_ERROR,
        `无效的目标文件路径: ${target}`,
        { target, traceId }
      );
    }

    if (source === target) {
      throw new MCPError(
        ErrorCode.VALIDATION_ERROR,
        '源文件和目标文件不能相同',
        { source, target, traceId }
      );
    }

    // 检查源文件是否存在
    let sourceMetadata;
    try {
      sourceMetadata = await storage.getFileMetadata(source);
    } catch (error) {
      if (error instanceof MCPError && error.code === ErrorCode.FILE_NOT_FOUND) {
        throw new MCPError(
          ErrorCode.FILE_NOT_FOUND,
          `源文件不存在: ${source}`,
          { source, traceId }
        );
      }
      throw error;
    }

    // 检查目标文件是否存在
    let targetExists = false;
    try {
      await storage.getFileMetadata(target);
      targetExists = true;
    } catch (error) {
      if (!(error instanceof MCPError && error.code === ErrorCode.FILE_NOT_FOUND)) {
        logger?.warn('检查目标文件存在性时出错', {
          target,
          error: error instanceof Error ? error.message : String(error),
          traceId
        });
      }
    }

    // 如果目标文件存在且不允许覆盖，抛出错误
    if (targetExists && !overwrite) {
      throw new MCPError(
        ErrorCode.VALIDATION_ERROR,
        `目标文件已存在且不允许覆盖: ${target}`,
        { target, overwrite, traceId }
      );
    }

    // 执行文件复制
    const startTime = Date.now();
    await storage.copyFile(source, target);
    const duration = Date.now() - startTime;

    // 获取复制后的文件信息
    let targetMetadata;
    try {
      targetMetadata = await storage.getFileMetadata(target);
    } catch (error) {
      logger?.warn('获取复制后文件元数据失败', {
        target,
        error: error instanceof Error ? error.message : String(error),
        traceId
      });
    }

    const result: CopyObjectResult = {
      source,
      target,
      success: true,
      etag: targetMetadata?.etag || '',
      copyTime: new Date().toISOString()
    };

    logger?.info('文件复制成功', {
      source,
      target,
      sourceSize: sourceMetadata.size,
      targetSize: targetMetadata?.size,
      targetExists: targetExists,
      duration,
      traceId
    });

    return result;

  } catch (error) {
    logger?.error('文件复制失败', {
      source,
      target,
      error: error instanceof Error ? error.message : String(error),
      traceId
    });

    if (error instanceof MCPError) {
      throw error;
    }

    throw new MCPError(
      ErrorCode.OSS_CONNECTION_ERROR,
      `文件复制失败: ${error instanceof Error ? error.message : String(error)}`,
      { source, target, traceId, error }
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

  // 检查是否包含相对路径
  const pathParts = fileName.split('/');
  for (const part of pathParts) {
    if (part === '.' || part === '..') {
      return false;
    }
  }

  return true;
}

/**
 * 文件复制工具定义
 */
export const copyObjectTool: ToolDefinition = {
  name: 'copyObject',
  description: '在阿里云OSS中复制文件',
  inputSchema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: '源文件路径'
      },
      target: {
        type: 'string',
        description: '目标文件路径'
      },
      overwrite: {
        type: 'boolean',
        description: '是否覆盖已存在的目标文件，默认true',
        default: true
      },
      metadata: {
        type: 'object',
        description: '新的自定义元数据（可选）',
        additionalProperties: {
          type: 'string'
        }
      }
    },
    required: ['source', 'target'],
    additionalProperties: false
  },
  handler: copyObjectHandler as ToolHandler<CopyObjectArgs, CopyObjectResult>
};