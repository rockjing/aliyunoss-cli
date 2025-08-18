/**
 * 阿里云OSS MCP服务 - 文件列表工具
 * 
 * @fileoverview 列出文件的MCP工具实现
 * @author alioss-mcp team
 * @version 1.0.0
 */

import {
  ToolDefinition,
  ToolContext,
  ListObjectsArgs,
  ListObjectsResult,
  ObjectInfo,
  MCPError,
  ErrorCode,
  ToolHandler
} from '../types/index.js';

/**
 * 文件列表工具处理函数
 */
async function listFilesHandler(
  args: ListObjectsArgs,
  context: ToolContext
): Promise<ListObjectsResult> {
  const { prefix = '', maxKeys = 100, marker, delimiter } = args;
  const { logger, storage, traceId } = context;
  
  try {
    logger?.info('开始列出文件', {
      prefix,
      maxKeys,
      marker,
      delimiter,
      traceId
    });

    // 验证参数
    if (maxKeys < 1 || maxKeys > 1000) {
      throw new MCPError(
        ErrorCode.VALIDATION_ERROR,
        `maxKeys必须在1-1000之间: ${maxKeys}`,
        { maxKeys, traceId }
      );
    }

    if (prefix && prefix.length > 1023) {
      throw new MCPError(
        ErrorCode.VALIDATION_ERROR,
        `前缀长度不能超过1023字符: ${prefix.length}`,
        { prefix, traceId }
      );
    }

    // 验证前缀格式
    if (prefix && !isValidPrefix(prefix)) {
      throw new MCPError(
        ErrorCode.VALIDATION_ERROR,
        `无效的前缀格式: ${prefix}`,
        { prefix, traceId }
      );
    }

    // 构建列表选项
    const listOptions: any = {
      prefix,
      maxKeys,
      marker,
      delimiter
    };

    // 执行文件列表查询
    const startTime = Date.now();
    const listResult = await storage.listFiles(listOptions);
    const duration = Date.now() - startTime;

    // 转换结果格式
    const objects: ObjectInfo[] = listResult.objects.map((obj: any) => ({
      name: obj.name,
      size: obj.size,
      lastModified: obj.lastModified.toISOString(),
      etag: obj.etag,
      storageClass: obj.storageClass,
      contentType: getContentTypeFromFileName(obj.name)
    }));

    // 计算文件统计信息
    const totalSize = objects.reduce((sum, obj) => sum + obj.size, 0);
    const fileTypes = getFileTypeStats(objects);

    const result: ListObjectsResult = {
      objects,
      prefixes: listResult.prefixes || [],
      nextMarker: listResult.nextMarker,
      isTruncated: listResult.isTruncated,
      count: objects.length
    };

    logger?.info('文件列表获取成功', {
      prefix,
      count: objects.length,
      totalSize,
      isTruncated: listResult.isTruncated,
      fileTypes,
      duration,
      traceId
    });

    return result;

  } catch (error) {
    logger?.error('文件列表获取失败', {
      prefix,
      maxKeys,
      marker,
      delimiter,
      error: error instanceof Error ? error.message : String(error),
      traceId
    });

    if (error instanceof MCPError) {
      throw error;
    }

    throw new MCPError(
      ErrorCode.OSS_CONNECTION_ERROR,
      `文件列表获取失败: ${error instanceof Error ? error.message : String(error)}`,
      { prefix, maxKeys, marker, delimiter, traceId, error }
    );
  }
}

/**
 * 验证前缀是否合法
 */
function isValidPrefix(prefix: string): boolean {
  // 检查是否包含非法字符（根据OSS规范）
  const illegalChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
  if (illegalChars.test(prefix)) {
    return false;
  }

  // 检查是否以/开头（OSS不允许）
  if (prefix.startsWith('/')) {
    return false;
  }

  // 检查是否包含连续的斜杠
  if (prefix.includes('//')) {
    return false;
  }

  // 检查是否包含相对路径
  const pathParts = prefix.split('/');
  for (const part of pathParts) {
    if (part === '.' || part === '..') {
      return false;
    }
  }

  return true;
}

/**
 * 根据文件名获取内容类型
 */
function getContentTypeFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext) return 'application/octet-stream';

  const contentTypes: Record<string, string> = {
    // 图片
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    
    // 文档
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    
    // 文本
    'txt': 'text/plain',
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'xml': 'application/xml',
    'csv': 'text/csv',
    'md': 'text/markdown',
    
    // 压缩
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    
    // 音频
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'aac': 'audio/aac',
    'ogg': 'audio/ogg',
    
    // 视频
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'mkv': 'video/x-matroska',
    'webm': 'video/webm'
  };

  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * 获取文件类型统计
 */
function getFileTypeStats(objects: ObjectInfo[]): Record<string, number> {
  const stats: Record<string, number> = {};
  
  for (const obj of objects) {
    const contentType = obj.contentType || 'unknown';
    const category = getFileCategory(contentType);
    stats[category] = (stats[category] || 0) + 1;
  }
  
  return stats;
}

/**
 * 根据内容类型获取文件分类
 */
function getFileCategory(contentType: string): string {
  if (contentType.startsWith('image/')) return 'images';
  if (contentType.startsWith('video/')) return 'videos';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.startsWith('text/')) return 'text';
  if (contentType.includes('pdf')) return 'documents';
  if (contentType.includes('word') || contentType.includes('excel') || contentType.includes('powerpoint')) return 'documents';
  if (contentType.includes('zip') || contentType.includes('rar') || contentType.includes('tar') || contentType.includes('gz')) return 'archives';
  if (contentType.includes('json') || contentType.includes('xml') || contentType.includes('javascript')) return 'data';
  return 'others';
}


/**
 * 文件列表工具定义
 */
export const listFilesTool: ToolDefinition = {
  name: 'listObjects',
  description: '列出阿里云OSS中的文件',
  inputSchema: {
    type: 'object',
    properties: {
      prefix: {
        type: 'string',
        description: '文件名前缀过滤（可选）'
      },
      maxKeys: {
        type: 'number',
        description: '最大返回文件数量，默认100，最大1000',
        minimum: 1,
        maximum: 1000,
        default: 100
      },
      marker: {
        type: 'string',
        description: '分页标记，用于获取下一页结果（可选）'
      },
      delimiter: {
        type: 'string',
        description: '分隔符，用于分组显示（可选）'
      }
    },
    required: [],
    additionalProperties: false
  },
  handler: listFilesHandler as ToolHandler<ListObjectsArgs, ListObjectsResult>
};