/**
 * 阿里云OSS MCP服务 - 工具相关类型定义
 * 
 * @fileoverview 定义MCP工具相关的接口和类型
 * @author aigroup-aliyunoss-mcp team
 * @version 1.0.0
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolHandler } from './index.js';

/**
 * 文件上传工具参数
 */
export interface UploadFileArgs {
  /** 文件名 */
  fileName: string;
  /** 文件内容 (Base64编码或文件路径) */
  file: string;
  /** 内容类型 */
  contentType?: string;
  /** 存储类型 */
  storageClass?: string;
  /** 自定义元数据 */
  metadata?: Record<string, string>;
}

/**
 * 文件上传工具结果
 */
export interface UploadFileResult {
  /** 文件名 */
  fileName: string;
  /** 文件URL */
  url: string;
  /** 文件大小 */
  size: number;
  /** ETag */
  etag: string;
  /** 上传时间 */
  uploadTime: string;
  /** 存储类型 */
  storageClass?: string;
}

/**
 * 文件下载工具参数
 */
export interface DownloadFileArgs {
  /** 文件名 */
  fileName: string;
  /** 本地保存路径 */
  localPath: string;
}

/**
 * 文件下载工具结果
 */
export interface DownloadFileResult {
  /** 本地文件路径 */
  localPath: string;
  /** 文件大小 */
  size: number;
  /** 下载成功标志 */
  success: boolean;
  /** 下载时间 */
  downloadTime: string;
}

/**
 * 删除文件工具参数
 */
export interface DeleteObjectArgs {
  /** 文件名 */
  fileName: string;
}

/**
 * 删除文件工具结果
 */
export interface DeleteObjectResult {
  /** 文件名 */
  fileName: string;
  /** 删除成功标志 */
  success: boolean;
  /** 删除时间 */
  deleteTime: string;
}

/**
 * 批量删除文件工具参数
 */
export interface DeleteMultipleObjectsArgs {
  /** 文件名列表 */
  fileNames: string[];
}

/**
 * 批量删除文件工具结果
 */
export interface DeleteMultipleObjectsResult {
  /** 删除成功的文件 */
  deleted: Array<{
    fileName: string;
    success: boolean;
  }>;
  /** 删除失败的文件 */
  errors: Array<{
    fileName: string;
    error: string;
  }>;
  /** 总处理数量 */
  total: number;
  /** 成功数量 */
  successCount: number;
  /** 失败数量 */
  errorCount: number;
}

/**
 * 列出文件工具参数
 */
export interface ListObjectsArgs {
  /** 前缀过滤 */
  prefix?: string;
  /** 最大返回数量 */
  maxKeys?: number;
  /** 分页标记 */
  marker?: string;
  /** 分隔符 */
  delimiter?: string;
}

/**
 * 文件信息
 */
export interface ObjectInfo {
  /** 文件名 */
  name: string;
  /** 文件大小 */
  size: number;
  /** 最后修改时间 */
  lastModified: string;
  /** ETag */
  etag: string;
  /** 存储类型 */
  storageClass: string;
  /** 内容类型 */
  contentType?: string;
}

/**
 * 列出文件工具结果
 */
export interface ListObjectsResult {
  /** 文件列表 */
  objects: ObjectInfo[];
  /** 公共前缀 */
  prefixes?: string[];
  /** 下一页标记 */
  nextMarker?: string;
  /** 是否截断 */
  isTruncated: boolean;
  /** 总数量 */
  count: number;
}

/**
 * 生成临时URL工具参数
 */
export interface GetObjectUrlArgs {
  /** 文件名 */
  fileName: string;
  /** 过期时间（秒） */
  expires?: number;
  /** HTTP方法 */
  method?: 'GET' | 'PUT' | 'POST' | 'DELETE';
}

/**
 * 生成临时URL工具结果
 */
export interface GetObjectUrlResult {
  /** 临时URL */
  url: string;
  /** 文件名 */
  fileName: string;
  /** 过期时间 */
  expires: number;
  /** 过期时间戳 */
  expiresAt: string;
  /** HTTP方法 */
  method: string;
}

/**
 * 复制文件工具参数
 */
export interface CopyObjectArgs {
  /** 源文件路径 */
  source: string;
  /** 目标文件路径 */
  target: string;
  /** 是否覆盖目标文件 */
  overwrite?: boolean;
  /** 新的元数据 */
  metadata?: Record<string, string>;
}

/**
 * 复制文件工具结果
 */
export interface CopyObjectResult {
  /** 源文件路径 */
  source: string;
  /** 目标文件路径 */
  target: string;
  /** 复制成功标志 */
  success: boolean;
  /** 目标文件ETag */
  etag: string;
  /** 复制时间 */
  copyTime: string;
}

/**
 * 获取文件元数据工具参数
 */
export interface GetObjectMetaArgs {
  /** 文件名 */
  fileName: string;
}

/**
 * 获取文件元数据工具结果
 */
export interface GetObjectMetaResult {
  /** 文件名 */
  fileName: string;
  /** 文件大小 */
  size: number;
  /** 最后修改时间 */
  lastModified: string;
  /** 内容类型 */
  contentType: string;
  /** ETag */
  etag: string;
  /** 存储类型 */
  storageClass: string;
  /** 自定义元数据 */
  metadata: Record<string, string>;
  /** 版本ID */
  versionId?: string;
}

/**
 * 设置文件权限工具参数
 */
export interface PutObjectACLArgs {
  /** 文件名 */
  fileName: string;
  /** 权限设置 */
  acl: 'private' | 'public-read' | 'public-read-write';
}

/**
 * 设置文件权限工具结果
 */
export interface PutObjectACLResult {
  /** 文件名 */
  fileName: string;
  /** 权限设置 */
  acl: string;
  /** 设置成功标志 */
  success: boolean;
  /** 设置时间 */
  setTime: string;
}

/**
 * 获取文件权限工具参数
 */
export interface GetObjectACLArgs {
  /** 文件名 */
  fileName: string;
}

/**
 * 获取文件权限工具结果
 */
export interface GetObjectACLResult {
  /** 文件名 */
  fileName: string;
  /** 权限设置 */
  acl: string;
  /** 所有者信息 */
  owner: {
    id: string;
    displayName: string;
  };
  /** 权限授予列表 */
  grants?: Array<{
    permission: string;
    grantee: {
      type: string;
      id?: string;
      displayName?: string;
      uri?: string;
    };
  }>;
}

/**
 * 分片上传工具参数
 */
export interface MultipartUploadArgs {
  /** 文件名 */
  fileName: string;
  /** 本地文件路径 */
  filePath: string;
  /** 分片大小（字节） */
  partSize?: number;
  /** 并发数 */
  concurrency?: number;
  /** 内容类型 */
  contentType?: string;
}

/**
 * 分片上传工具结果
 */
export interface MultipartUploadResult {
  /** 文件名 */
  fileName: string;
  /** 文件位置 */
  location: string;
  /** 文件大小 */
  size: number;
  /** ETag */
  etag: string;
  /** 分片数量 */
  partsCount: number;
  /** 上传时间 */
  uploadTime: string;
  /** 上传耗时（毫秒） */
  duration: number;
}

/**
 * 初始化分片上传工具参数
 */
export interface InitMultipartUploadArgs {
  /** 文件名 */
  fileName: string;
  /** 内容类型 */
  contentType?: string;
  /** 存储类型 */
  storageClass?: string;
  /** 自定义元数据 */
  metadata?: Record<string, string>;
}

/**
 * 初始化分片上传工具结果
 */
export interface InitMultipartUploadResult {
  /** 文件名 */
  fileName: string;
  /** 上传ID */
  uploadId: string;
  /** 初始化时间 */
  initTime: string;
}

/**
 * 上传分片工具参数
 */
export interface UploadPartArgs {
  /** 文件名 */
  fileName: string;
  /** 上传ID */
  uploadId: string;
  /** 分片号 */
  partNo: number;
  /** 本地文件路径 */
  filePath: string;
  /** 分片起始位置（字节） */
  start: number;
  /** 分片结束位置（字节） */
  end: number;
}

/**
 * 上传分片工具结果
 */
export interface UploadPartResult {
  /** 分片号 */
  partNo: number;
  /** ETag */
  etag: string;
  /** 分片大小 */
  size: number;
  /** 上传时间 */
  uploadTime: string;
}

/**
 * 完成分片上传工具参数
 */
export interface CompleteMultipartUploadArgs {
  /** 文件名 */
  fileName: string;
  /** 上传ID */
  uploadId: string;
  /** 已上传的分片信息列表 */
  parts: Array<{
    number: number;
    etag: string;
  }>;
}

/**
 * 完成分片上传工具结果
 */
export interface CompleteMultipartUploadResult {
  /** 文件名 */
  fileName: string;
  /** 文件位置 */
  location: string;
  /** 存储桶 */
  bucket: string;
  /** 文件键 */
  key: string;
  /** ETag */
  etag: string;
  /** 文件大小 */
  size: number;
  /** 完成时间 */
  completeTime: string;
}

/**
 * 取消分片上传工具参数
 */
export interface AbortMultipartUploadArgs {
  /** 文件名 */
  fileName: string;
  /** 上传ID */
  uploadId: string;
}

/**
 * 取消分片上传工具结果
 */
export interface AbortMultipartUploadResult {
  /** 文件名 */
  fileName: string;
  /** 上传ID */
  uploadId: string;
  /** 取消成功标志 */
  success: boolean;
  /** 取消时间 */
  abortTime: string;
}

/**
 * 列出进行中的分片上传工具参数
 */
export interface ListUploadsArgs {
  /** 前缀过滤 */
  prefix?: string;
  /** 最大返回数量 */
  maxUploads?: number;
  /** 键标记 */
  keyMarker?: string;
  /** 上传ID标记 */
  uploadIdMarker?: string;
}

/**
 * 分片上传信息
 */
export interface MultipartUploadInfo {
  /** 文件键 */
  key: string;
  /** 上传ID */
  uploadId: string;
  /** 存储类型 */
  storageClass: string;
  /** 初始化时间 */
  initiated: string;
  /** 所有者信息 */
  owner: {
    id: string;
    displayName: string;
  };
}

/**
 * 列出进行中的分片上传工具结果
 */
export interface ListUploadsResult {
  /** 分片上传列表 */
  uploads: MultipartUploadInfo[];
  /** 公共前缀 */
  prefixes?: string[];
  /** 是否截断 */
  isTruncated: boolean;
  /** 下一个键标记 */
  nextKeyMarker?: string;
  /** 下一个上传ID标记 */
  nextUploadIdMarker?: string;
  /** 总数量 */
  count: number;
}

/**
 * 工具验证规则
 */
export interface ToolValidationRule {
  /** 参数名 */
  parameter: string;
  /** 验证类型 */
  type: 'required' | 'type' | 'range' | 'pattern' | 'custom';
  /** 验证值 */
  value: any;
  /** 错误消息 */
  message: string;
}

/**
 * 工具中间件配置
 */
export interface ToolMiddlewareConfig {
  /** 中间件名称 */
  name: string;
  /** 是否启用 */
  enabled: boolean;
  /** 中间件选项 */
  options: Record<string, any>;
  /** 执行顺序 */
  order: number;
}

/**
 * 工具性能配置
 */
export interface ToolPerformanceConfig {
  /** 超时时间（毫秒） */
  timeout: number;
  /** 重试次数 */
  retries: number;
  /** 重试延迟（毫秒） */
  retryDelay: number;
  /** 是否启用缓存 */
  cache: boolean;
  /** 缓存TTL（秒） */
  cacheTTL: number;
}

/**
 * 工具安全配置
 */
export interface ToolSecurityConfig {
  /** 是否需要认证 */
  requireAuth: boolean;
  /** 允许的角色 */
  allowedRoles: string[];
  /** 速率限制 */
  rateLimit: {
    requests: number;
    window: number; // 秒
  };
  /** 参数验证规则 */
  validation: ToolValidationRule[];
}

/**
 * 工具元数据
 */
export interface ToolMetadata {
  /** 工具分类 */
  category: string;
  /** 工具标签 */
  tags: string[];
  /** 工具版本 */
  version: string;
  /** 工具作者 */
  author: string;
  /** 创建时间 */
  created: string;
  /** 更新时间 */
  updated: string;
  /** 是否已弃用 */
  deprecated: boolean;
  /** 实验性功能 */
  experimental: boolean;
}

/**
 * 扩展工具定义
 */
export interface ExtendedToolDefinition extends Tool {
  /** 工具处理器 */
  handler: ToolHandler;
  /** 工具元数据 */
  metadata: ToolMetadata;
  /** 性能配置 */
  performance: ToolPerformanceConfig;
  /** 安全配置 */
  security: ToolSecurityConfig;
  /** 中间件配置 */
  middleware: ToolMiddlewareConfig[];
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 工具执行结果
 */
export interface ToolExecutionResult<T = any> {
  /** 执行成功标志 */
  success: boolean;
  /** 结果数据 */
  data?: T;
  /** 错误信息 */
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  /** 执行元数据 */
  metadata: {
    /** 工具名称 */
    toolName: string;
    /** 执行时间 */
    executionTime: number;
    /** 开始时间 */
    startTime: string;
    /** 结束时间 */
    endTime: string;
    /** 跟踪ID */
    traceId: string;
    /** 版本号 */
    version: string;
  };
}

/**
 * 工具调用统计
 */
export interface ToolCallStats {
  /** 工具名称 */
  toolName: string;
  /** 调用次数 */
  callCount: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  errorCount: number;
  /** 平均执行时间（毫秒） */
  averageExecutionTime: number;
  /** 最小执行时间（毫秒） */
  minExecutionTime: number;
  /** 最大执行时间（毫秒） */
  maxExecutionTime: number;
  /** 最后调用时间 */
  lastCallTime: string;
  /** 错误率 */
  errorRate: number;
}

/**
 * 工具健康状态
 */
export interface ToolHealthStatus {
  /** 工具名称 */
  toolName: string;
  /** 健康状态 */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** 状态消息 */
  message: string;
  /** 检查时间 */
  checkTime: string;
  /** 响应时间（毫秒） */
  responseTime: number;
  /** 可用性百分比 */
  availability: number;
  /** 依赖状态 */
  dependencies: Record<string, 'ok' | 'warning' | 'error'>;
}

/**
 * 工具配置验证结果
 */
export interface ToolConfigValidationResult {
  /** 验证结果 */
  valid: boolean;
  /** 错误列表 */
  errors: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
  /** 警告列表 */
  warnings: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
}

/**
 * 工具注册信息
 */
export interface ToolRegistrationInfo {
  /** 工具名称 */
  name: string;
  /** 注册时间 */
  registeredAt: string;
  /** 注册来源 */
  source: 'core' | 'plugin' | 'external';
  /** 工具状态 */
  status: 'active' | 'inactive' | 'error';
  /** 最后活动时间 */
  lastActivity: string;
  /** 工具版本 */
  version: string;
}