/**
 * 阿里云OSS MCP服务 - 文件删除工具
 * 
 * @fileoverview 删除文件的MCP工具实现
 * @author alioss-mcp team
 * @version 1.0.0
 */

import {
  ToolDefinition,
  ToolContext,
  DeleteObjectArgs,
  DeleteObjectResult,
  DeleteMultipleObjectsArgs,
  DeleteMultipleObjectsResult,
  MCPError,
  ErrorCode,
  ToolHandler
} from '../types/index.js';

/**
 * 单文件删除工具处理函数
 */
async function deleteFileHandler(
  args: DeleteObjectArgs,
  context: ToolContext
): Promise<DeleteObjectResult> {
  const { fileName } = args;
  const { logger, storage, traceId } = context;
  
  try {
    logger?.info('开始删除文件', {
      fileName,
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

    // 检查文件是否存在
    let fileExists = true;
    try {
      await storage.getFileMetadata(fileName);
    } catch (error) {
      if (error instanceof MCPError && error.code === ErrorCode.FILE_NOT_FOUND) {
        fileExists = false;
        logger?.warn('要删除的文件不存在', { fileName, traceId });
      } else {
        // 其他错误继续执行删除操作
        logger?.warn('检查文件存在性时出错，继续执行删除', {
          fileName,
          error: error instanceof Error ? error.message : String(error),
          traceId
        });
      }
    }

    // 执行删除操作
    const startTime = Date.now();
    await storage.deleteFile(fileName);
    const duration = Date.now() - startTime;

    const result: DeleteObjectResult = {
      fileName,
      success: true,
      deleteTime: new Date().toISOString()
    };

    logger?.info('文件删除成功', {
      fileName,
      fileExists,
      duration,
      traceId
    });

    return result;

  } catch (error) {
    logger?.error('文件删除失败', {
      fileName,
      error: error instanceof Error ? error.message : String(error),
      traceId
    });

    if (error instanceof MCPError) {
      throw error;
    }

    throw new MCPError(
      ErrorCode.FILE_DELETE_FAILED,
      `文件删除失败: ${error instanceof Error ? error.message : String(error)}`,
      { fileName, traceId, error }
    );
  }
}

/**
 * 批量删除工具处理函数
 */
async function deleteMultipleFilesHandler(
  args: DeleteMultipleObjectsArgs,
  context: ToolContext
): Promise<DeleteMultipleObjectsResult> {
  const { fileNames } = args;
  const { logger, storage, traceId } = context;
  
  try {
    logger?.info('开始批量删除文件', {
      count: fileNames.length,
      traceId
    });

    // 验证文件名列表
    const invalidFileNames: string[] = [];
    for (const fileName of fileNames) {
      if (!isValidFileName(fileName)) {
        invalidFileNames.push(fileName);
      }
    }

    if (invalidFileNames.length > 0) {
      throw new MCPError(
        ErrorCode.VALIDATION_ERROR,
        `以下文件名无效: ${invalidFileNames.join(', ')}`,
        { invalidFileNames, traceId }
      );
    }

    // 去重文件名
    const uniqueFileNames = Array.from(new Set(fileNames));
    if (uniqueFileNames.length !== fileNames.length) {
      logger?.warn('检测到重复的文件名，已自动去重', {
        originalCount: fileNames.length,
        uniqueCount: uniqueFileNames.length,
        traceId
      });
    }

    // 执行批量删除
    const startTime = Date.now();
    
    let deleted: Array<{ fileName: string; success: boolean }> = [];
    let errors: Array<{ fileName: string; error: string }> = [];

    // 如果存储服务支持批量删除，使用批量删除
    if (storage.deleteMultipleFiles) {
      try {
        const batchResult = await storage.deleteMultipleFiles(uniqueFileNames);
        
        // 处理批量删除结果
        for (const deletedItem of batchResult.deleted || []) {
          deleted.push({
            fileName: deletedItem.key,
            success: true
          });
        }
        
        for (const errorItem of batchResult.errors || []) {
          errors.push({
            fileName: errorItem.key,
            error: `${errorItem.code}: ${errorItem.message}`
          });
        }
        
      } catch (error) {
        // 批量删除失败，回退到逐个删除
        logger?.warn('批量删除失败，回退到逐个删除', {
          error: error instanceof Error ? error.message : String(error),
          traceId
        });
        
        ({ deleted, errors } = await deleteFilesOneByOne(uniqueFileNames, storage, logger, traceId));
      }
    } else {
      // 逐个删除
      ({ deleted, errors } = await deleteFilesOneByOne(uniqueFileNames, storage, logger, traceId));
    }

    const duration = Date.now() - startTime;
    
    const result: DeleteMultipleObjectsResult = {
      deleted,
      errors,
      total: uniqueFileNames.length,
      successCount: deleted.length,
      errorCount: errors.length
    };

    logger?.info('批量删除文件完成', {
      total: uniqueFileNames.length,
      successCount: deleted.length,
      errorCount: errors.length,
      duration,
      traceId
    });

    return result;

  } catch (error) {
    logger?.error('批量删除文件失败', {
      fileNames,
      error: error instanceof Error ? error.message : String(error),
      traceId
    });

    if (error instanceof MCPError) {
      throw error;
    }

    throw new MCPError(
      ErrorCode.FILE_DELETE_FAILED,
      `批量删除文件失败: ${error instanceof Error ? error.message : String(error)}`,
      { fileNames, traceId, error }
    );
  }
}

/**
 * 逐个删除文件的辅助函数
 */
async function deleteFilesOneByOne(
  fileNames: string[],
  storage: any,
  logger: any,
  traceId: string
): Promise<{
  deleted: Array<{ fileName: string; success: boolean }>;
  errors: Array<{ fileName: string; error: string }>;
}> {
  const deleted: Array<{ fileName: string; success: boolean }> = [];
  const errors: Array<{ fileName: string; error: string }> = [];

  // 并发删除，但限制并发数
  const concurrency = 5;
  const chunks = [];
  for (let i = 0; i < fileNames.length; i += concurrency) {
    chunks.push(fileNames.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (fileName) => {
      try {
        await storage.deleteFile(fileName);
        deleted.push({ fileName, success: true });
        logger?.debug('文件删除成功', { fileName, traceId });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ fileName, error: errorMessage });
        logger?.debug('文件删除失败', { fileName, error: errorMessage, traceId });
      }
    });

    await Promise.all(promises);
  }

  return { deleted, errors };
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
 * 单文件删除工具定义
 */
export const deleteFileTool: ToolDefinition = {
  name: 'deleteObject',
  description: '删除阿里云OSS中的单个文件',
  inputSchema: {
    type: 'object',
    properties: {
      fileName: {
        type: 'string',
        description: '要删除的文件名（包含路径）'
      }
    },
    required: ['fileName'],
    additionalProperties: false
  },
  handler: deleteFileHandler as ToolHandler<DeleteObjectArgs, DeleteObjectResult>
};

/**
 * 批量删除工具定义
 */
export const deleteMultipleFilesTool: ToolDefinition = {
  name: 'deleteMultipleObjects',
  description: '批量删除阿里云OSS中的多个文件',
  inputSchema: {
    type: 'object',
    properties: {
      fileNames: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: '要删除的文件名列表',
        minItems: 1,
        maxItems: 1000
      }
    },
    required: ['fileNames'],
    additionalProperties: false
  },
  handler: deleteMultipleFilesHandler as ToolHandler<DeleteMultipleObjectsArgs, DeleteMultipleObjectsResult>
};