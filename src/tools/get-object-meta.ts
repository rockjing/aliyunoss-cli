/**
 * 阿里云OSS MCP服务 - 获取文件元数据工具
 * 
 * @fileoverview 获取文件元数据的MCP工具实现
 * @author aigroup-aliyunoss-mcp team
 * @version 1.0.0
 */

import {
  ToolDefinition,
  ToolContext,
  GetObjectMetaArgs,
  GetObjectMetaResult,
  MCPError,
  ErrorCode,
  ToolHandler
} from '../types/index.js';
import { validateObjectKey } from '../security/object-key.js';

/**
 * 获取文件元数据工具处理函数
 */
async function getObjectMetaHandler(
  args: GetObjectMetaArgs,
  context: ToolContext
): Promise<GetObjectMetaResult> {
  const { fileName } = args;
  const { logger, storage, traceId } = context;
  
  try {
    logger?.info('开始获取文件元数据', {
      fileName,
      traceId
    });

    // 验证文件名
    const fileNameValidation = validateObjectKey(fileName);
    if (!fileNameValidation.valid) {
      throw new MCPError(
        ErrorCode.VALIDATION_ERROR,
        `无效的文件名: ${fileName}（${fileNameValidation.reason}）`,
        { fileName, reason: fileNameValidation.reason, traceId }
      );
    }

    // 获取文件元数据
    const startTime = Date.now();
    const metadata = await storage.getFileMetadata(fileName);
    const duration = Date.now() - startTime;

    const result: GetObjectMetaResult = {
      fileName: metadata.name,
      size: metadata.size,
      lastModified: metadata.lastModified.toISOString(),
      contentType: metadata.contentType,
      etag: metadata.etag,
      storageClass: metadata.storageClass || 'Standard',
      metadata: metadata.metadata || {},
      versionId: metadata.versionId
    };

    logger?.info('文件元数据获取成功', {
      fileName,
      size: metadata.size,
      contentType: metadata.contentType,
      duration,
      traceId
    });

    return result;

  } catch (error) {
    logger?.error('获取文件元数据失败', {
      fileName,
      error: error instanceof Error ? error.message : String(error),
      traceId
    });

    if (error instanceof MCPError) {
      throw error;
    }

    throw new MCPError(
      ErrorCode.OSS_CONNECTION_ERROR,
      `获取文件元数据失败: ${error instanceof Error ? error.message : String(error)}`,
      { fileName, traceId, error }
    );
  }
}

/**
 * 获取文件元数据工具定义
 */
export const getObjectMetaTool: ToolDefinition = {
  name: 'getObjectMeta',
  description: '获取阿里云OSS文件的元数据信息',
  inputSchema: {
    type: 'object',
    properties: {
      fileName: {
        type: 'string',
        description: '文件名（包含路径）'
      }
    },
    required: ['fileName'],
    additionalProperties: false
  },
  handler: getObjectMetaHandler as ToolHandler<GetObjectMetaArgs, GetObjectMetaResult>
};
