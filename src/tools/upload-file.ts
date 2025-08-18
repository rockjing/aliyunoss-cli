/**
 * 阿里云OSS MCP服务 - 文件上传工具
 * 
 * @fileoverview 文件上传功能的MCP工具实现
 * @author alioss-mcp team
 * @version 1.0.0
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { extname } from 'path';
import {
  ToolDefinition,
  ToolContext,
  UploadFileArgs,
  UploadFileResult,
  MCPError,
  ErrorCode,
  ToolHandler
} from '../types/index.js';

/**
 * 文件上传工具处理函数
 */
async function uploadFileHandler(
  args: UploadFileArgs,
  context: ToolContext
): Promise<UploadFileResult> {
  const { fileName, file, contentType, storageClass, metadata } = args;
  const { logger, storage, traceId } = context;
  
  try {
    logger?.info('开始处理文件上传请求', {
      fileName,
      contentType,
      storageClass,
      traceId
    });

    // 准备文件内容
    let fileContent: Buffer;
    let actualContentType = contentType;
    let fileSize = 0;

    // 判断是Base64内容还是文件路径
    if (file.startsWith('data:') || file.match(/^[A-Za-z0-9+/]+=*$/)) {
      // Base64编码的文件内容
      try {
        if (file.startsWith('data:')) {
          // data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...
          const matches = file.match(/^data:([^;]+);base64,(.+)$/);
          if (matches && matches[2]) {
            actualContentType = actualContentType || matches[1];
            fileContent = Buffer.from(matches[2], 'base64');
          } else {
            throw new Error('无效的Data URL格式');
          }
        } else {
          // 纯Base64内容
          fileContent = Buffer.from(file, 'base64');
        }
        fileSize = fileContent.length;
        
        logger?.info('使用Base64编码内容', {
          fileName,
          size: fileSize,
          contentType: actualContentType,
          traceId
        });
      } catch (error) {
        throw new MCPError(
          ErrorCode.VALIDATION_ERROR,
          `Base64内容解码失败: ${error instanceof Error ? error.message : String(error)}`,
          { fileName, traceId, error }
        );
      }
    } else {
      // 文件路径
      try {
        if (!existsSync(file)) {
          throw new MCPError(
            ErrorCode.FILE_NOT_FOUND,
            `文件不存在: ${file}`,
            { fileName, filePath: file, traceId }
          );
        }

        const stats = statSync(file);
        if (!stats.isFile()) {
          throw new MCPError(
            ErrorCode.VALIDATION_ERROR,
            `路径不是文件: ${file}`,
            { fileName, filePath: file, traceId }
          );
        }

        fileContent = readFileSync(file);
        fileSize = stats.size;

        // 自动检测内容类型
        if (!actualContentType) {
          actualContentType = getContentTypeFromExtension(extname(file));
        }

        logger?.info('使用本地文件路径', {
          fileName,
          filePath: file,
          size: fileSize,
          contentType: actualContentType,
          traceId
        });
      } catch (error) {
        if (error instanceof MCPError) {
          throw error;
        }
        throw new MCPError(
          ErrorCode.FILE_NOT_FOUND,
          `读取文件失败: ${error instanceof Error ? error.message : String(error)}`,
          { fileName, filePath: file, traceId, error }
        );
      }
    }

    // 验证文件大小
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    if (fileSize > maxFileSize) {
      throw new MCPError(
        ErrorCode.FILE_TOO_LARGE,
        `文件太大: ${Math.round(fileSize / 1024 / 1024)}MB，最大允许100MB`,
        { fileName, fileSize, maxFileSize, traceId }
      );
    }

    // 验证文件名
    if (!isValidFileName(fileName)) {
      throw new MCPError(
        ErrorCode.VALIDATION_ERROR,
        `无效的文件名: ${fileName}`,
        { fileName, traceId }
      );
    }

    // 准备上传选项
    const uploadOptions: any = {};
    if (actualContentType) {
      uploadOptions.contentType = actualContentType;
    }
    if (storageClass) {
      uploadOptions.storageClass = storageClass;
    }
    if (metadata) {
      uploadOptions.metadata = metadata;
    }

    // 执行上传
    const startTime = Date.now();
    const uploadedFileName = await storage.uploadFile(fileContent, fileName, uploadOptions);
    const duration = Date.now() - startTime;

    // 生成文件URL
    const fileUrl = await storage.generateTempUrl(uploadedFileName, 3600); // 1小时有效期

    const result: UploadFileResult = {
      fileName: uploadedFileName,
      url: fileUrl,
      size: fileSize,
      etag: '', // OSS会返回ETag，这里先设为空
      uploadTime: new Date().toISOString(),
      storageClass: storageClass || 'Standard'
    };

    logger?.info('文件上传成功', {
      fileName: uploadedFileName,
      size: fileSize,
      duration,
      traceId
    });

    return result;

  } catch (error) {
    logger?.error('文件上传失败', {
      fileName,
      error: error instanceof Error ? error.message : String(error),
      traceId
    });

    if (error instanceof MCPError) {
      throw error;
    }

    throw new MCPError(
      ErrorCode.FILE_UPLOAD_FAILED,
      `文件上传失败: ${error instanceof Error ? error.message : String(error)}`,
      { fileName, traceId, error }
    );
  }
}

/**
 * 根据文件扩展名获取内容类型
 */
function getContentTypeFromExtension(ext: string): string {
  const contentTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv'
  };

  return contentTypes[ext.toLowerCase()] || 'application/octet-stream';
}

/**
 * 验证文件名是否合法
 */
function isValidFileName(fileName: string): boolean {
  // 检查是否包含非法字符
  const illegalChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (illegalChars.test(fileName)) {
    return false;
  }

  // 检查是否为保留名称
  const reservedNames = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ];
  
  const nameWithoutExt = fileName.split('.')[0]?.toUpperCase() || '';
  if (reservedNames.includes(nameWithoutExt)) {
    return false;
  }

  // 检查长度
  if (fileName.length > 255) {
    return false;
  }

  // 检查是否以点或空格结尾
  if (fileName.endsWith('.') || fileName.endsWith(' ')) {
    return false;
  }

  return true;
}

/**
 * 文件上传工具定义
 */
export const uploadFileTool: ToolDefinition = {
  name: 'uploadFile',
  description: '上传文件到阿里云OSS',
  inputSchema: {
    type: 'object',
    properties: {
      fileName: {
        type: 'string',
        description: '目标文件名（包含路径）'
      },
      file: {
        type: 'string',
        description: '文件内容（Base64编码）或本地文件路径'
      },
      contentType: {
        type: 'string',
        description: '文件MIME类型（可选，会自动检测）'
      },
      storageClass: {
        type: 'string',
        enum: ['Standard', 'IA', 'Archive', 'ColdArchive'],
        description: '存储类型（可选，默认Standard）'
      },
      metadata: {
        type: 'object',
        description: '自定义元数据（可选）',
        additionalProperties: {
          type: 'string'
        }
      }
    },
    required: ['fileName', 'file'],
    additionalProperties: false
  },
  handler: uploadFileHandler as ToolHandler<UploadFileArgs, UploadFileResult>
};