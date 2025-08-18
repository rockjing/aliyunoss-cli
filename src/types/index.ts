/**
 * 阿里云OSS MCP服务 - 通用类型定义
 * 
 * @fileoverview 定义系统中使用的通用类型、接口和枚举
 * @author alioss-mcp team
 * @version 1.0.0
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * 错误代码枚举
 */
export enum ErrorCode {
  // 配置错误
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_MISSING = 'CONFIG_MISSING',
  
  // OSS服务错误
  OSS_CONNECTION_ERROR = 'OSS_CONNECTION_ERROR',
  OSS_AUTHENTICATION_ERROR = 'OSS_AUTHENTICATION_ERROR',
  OSS_PERMISSION_ERROR = 'OSS_PERMISSION_ERROR',
  OSS_TIMEOUT_ERROR = 'OSS_TIMEOUT_ERROR',
  
  // 文件操作错误
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_TYPE_NOT_ALLOWED = 'FILE_TYPE_NOT_ALLOWED',
  FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',
  FILE_DOWNLOAD_FAILED = 'FILE_DOWNLOAD_FAILED',
  FILE_DELETE_FAILED = 'FILE_DELETE_FAILED',
  
  // MCP协议错误
  MCP_INVALID_REQUEST = 'MCP_INVALID_REQUEST',
  MCP_TOOL_NOT_FOUND = 'MCP_TOOL_NOT_FOUND',
  MCP_PARAMETER_INVALID = 'MCP_PARAMETER_INVALID',
  
  // 分片上传错误
  MULTIPART_INIT_FAILED = 'MULTIPART_INIT_FAILED',
  MULTIPART_UPLOAD_FAILED = 'MULTIPART_UPLOAD_FAILED',
  MULTIPART_COMPLETE_FAILED = 'MULTIPART_COMPLETE_FAILED',
  
  // 通用错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * 健康检查状态枚举
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DEGRADED = 'degraded'
}

/**
 * 自定义错误类
 */
export class MCPError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, any>;
  public readonly timestamp: Date;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.details = details || {};
    this.timestamp = new Date();
  }

  /**
   * 转换为JSON格式
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }
}

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  status: HealthStatus;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  duration?: number;
}

/**
 * 完整健康检查状态
 */
export interface HealthReport {
  status: HealthStatus;
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    config: HealthCheckResult;
    oss: HealthCheckResult;
    memory: HealthCheckResult;
  };
}

/**
 * 文件元数据信息
 */
export interface FileMetadata {
  name: string;
  size: number;
  lastModified: Date;
  contentType: string;
  etag: string;
  storageClass?: string;
  owner?: {
    id: string;
    displayName: string;
  };
}

/**
 * 文件列表选项
 */
export interface ListOptions {
  prefix?: string;
  maxKeys?: number;
  marker?: string;
  delimiter?: string;
}

/**
 * 文件列表结果
 */
export interface ListResult {
  objects: FileMetadata[];
  prefixes?: string[];
  nextMarker?: string;
  isTruncated: boolean;
  maxKeys: number;
}

/**
 * 上传结果
 */
export interface UploadResult {
  name: string;
  url: string;
  size: number;
  etag: string;
  location?: string;
}

/**
 * 下载结果
 */
export interface DownloadResult {
  content: Buffer;
  metadata: FileMetadata;
}

/**
 * 分片信息
 */
export interface PartInfo {
  number: number;
  etag: string;
  size?: number;
}

/**
 * 分片上传结果
 */
export interface MultipartUploadResult {
  uploadId: string;
  fileName: string;
  location: string;
  bucket: string;
  key: string;
  etag: string;
  size: number;
  parts: PartInfo[];
}

/**
 * 权限类型枚举
 */
export enum ACLType {
  PRIVATE = 'private',
  PUBLIC_READ = 'public-read',
  PUBLIC_READ_WRITE = 'public-read-write'
}

/**
 * 权限信息
 */
export interface ACLInfo {
  acl: ACLType;
  owner: {
    id: string;
    displayName: string;
  };
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
 * 性能监控指标
 */
export interface PerformanceMetrics {
  operation: string;
  duration: number;
  size?: number;
  timestamp: string;
  success: boolean;
  error?: string;
}

/**
 * 日志条目
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  traceId?: string;
  userId?: string;
  operation?: string;
  duration?: number;
  metadata?: Record<string, any>;
  error?: {
    code: ErrorCode;
    message: string;
    stack?: string;
    details?: Record<string, any>;
  };
}

/**
 * 事件数据
 */
export interface EventData {
  type: string;
  source: string;
  timestamp: string;
  data: Record<string, any>;
  traceId?: string;
}

/**
 * 中间件上下文
 */
export interface MiddlewareContext {
  toolName: string;
  arguments: Record<string, any>;
  startTime: number;
  traceId: string;
  metadata: Record<string, any>;
}

/**
 * 中间件函数类型
 */
export type MiddlewareFunction = (
  context: MiddlewareContext,
  next: () => Promise<void>
) => Promise<void>;

/**
 * 中间件定义
 */
export interface MiddlewareDefinition {
  name: string;
  priority: number;
  handler: MiddlewareFunction;
  enabled?: boolean;
}

/**
 * 插件元数据
 */
export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
}

/**
 * 插件上下文
 */
export interface PluginContext {
  logger: any; // 日志记录器
  config: any; // 配置管理器
  eventBus: any; // 事件总线
  storage: any; // 存储服务
}

/**
 * 事件处理器类型
 */
export type EventHandler = (data?: any) => void | Promise<void>;

/**
 * 事件监听器定义
 */
export interface EventListenerDefinition {
  event: string;
  handler: EventHandler;
  once?: boolean;
}

/**
 * 工具调用上下文
 */
export interface ToolContext {
  toolName: string;
  arguments: Record<string, any>;
  traceId: string;
  startTime: number;
  logger: any;
  storage: any;
  config: any;
}

/**
 * 工具处理器类型
 */
export type ToolHandler<T = any, R = any> = (
  args: T,
  context: ToolContext
) => Promise<R>;

/**
 * 工具定义扩展
 */
export interface ToolDefinition extends Tool {
  handler: ToolHandler<any, any>;
  middleware?: string[];
  rateLimit?: {
    requests: number;
    window: number; // 时间窗口（秒）
  };
  cache?: {
    ttl: number; // 缓存时间（秒）
    key?: (args: Record<string, any>) => string;
  };
}

/**
 * 工具注册表
 */
export interface ToolRegistry {
  [toolName: string]: ToolDefinition;
}

/**
 * 缓存条目
 */
export interface CacheEntry<T = any> {
  value: T;
  expires: number;
  size: number;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  maxSize: number; // 最大缓存大小（字节）
  defaultTTL: number; // 默认TTL（秒）
  cleanupInterval: number; // 清理间隔（秒）
}

/**
 * 速率限制配置
 */
export interface RateLimitConfig {
  requests: number;
  window: number; // 时间窗口（秒）
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * 应用状态
 */
export interface AppState {
  initialized: boolean;
  startTime: Date;
  version: string;
  environment: string;
  health: HealthReport;
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    uptime: number;
  };
}

/**
 * 响应格式
 */
export interface MCPResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
    details?: Record<string, any>;
  };
  metadata?: {
    timestamp: string;
    traceId: string;
    duration: number;
    version: string;
  };
}

/**
 * 分页参数
 */
export interface PaginationParams {
  offset?: number;
  limit?: number;
  marker?: string;
  maxKeys?: number;
}

/**
 * 分页结果
 */
export interface PaginatedResult<T> {
  items: T[];
  total?: number;
  hasMore: boolean;
  nextMarker?: string;
  pagination: {
    offset: number;
    limit: number;
    total?: number;
  };
}

/**
 * 批量操作结果
 */
export interface BatchOperationResult {
  success: boolean;
  processed: number;
  failed: number;
  results: Array<{
    item: string;
    success: boolean;
    error?: string;
  }>;
}

// 导出所有类型
export * from './storage.js';
export * from './config.js';

// 导出工具相关类型，排除重复的MultipartUploadInfo
export type {
  UploadFileArgs,
  UploadFileResult,
  GetObjectUrlArgs,
  GetObjectUrlResult,
  DeleteObjectArgs,
  DeleteObjectResult,
  DeleteMultipleObjectsArgs,
  DeleteMultipleObjectsResult,
  ListObjectsArgs,
  ListObjectsResult,
  CopyObjectArgs,
  CopyObjectResult,
  GetObjectMetaArgs,
  GetObjectMetaResult,
  ObjectInfo
} from './tools.js';