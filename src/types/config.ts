/**
 * 阿里云OSS MCP服务 - 配置相关类型定义
 * 
 * @fileoverview 定义配置管理相关的接口和类型
 * @author alioss-mcp team
 * @version 1.0.0
 */

import { LogLevel } from './index.js';
import { StorageConfig } from './storage.js';

/**
 * 应用配置接口
 */
export interface AppConfig {
  /** OSS存储配置 */
  oss: StorageConfig;
  /** MCP服务器配置 */
  mcp: MCPConfig;
  /** 日志配置 */
  logging: LoggingConfig;
  /** 安全配置 */
  security: SecurityConfig;
  /** 性能配置 */
  performance: PerformanceConfig;
  /** 缓存配置 */
  cache: CacheConfig;
  /** 分片上传配置 */
  multipart: MultipartConfig;
  /** 监控配置 */
  monitoring: MonitoringConfig;
  /** 插件配置 */
  plugins: PluginConfig;
  /** 环境配置 */
  environment: EnvironmentConfig;
}

/**
 * MCP服务器配置
 */
export interface MCPConfig {
  /** 服务器名称 */
  name: string;
  /** 服务器版本 */
  version: string;
  /** 服务器描述 */
  description: string;
  /** 协议版本 */
  protocolVersion: string;
  /** 支持的能力 */
  capabilities: MCPCapabilities;
  /** 工具配置 */
  tools: ToolsConfig;
  /** 资源配置 */
  resources?: ResourcesConfig;
  /** 提示配置 */
  prompts?: PromptsConfig;
}

/**
 * MCP能力配置
 */
export interface MCPCapabilities {
  /** 是否支持工具 */
  tools?: {
    listChanged?: boolean;
  };
  /** 是否支持资源 */
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  /** 是否支持提示 */
  prompts?: {
    listChanged?: boolean;
  };
  /** 是否支持日志 */
  logging?: boolean;
}

/**
 * 工具配置
 */
export interface ToolsConfig {
  /** 启用的工具列表 */
  enabled: string[];
  /** 禁用的工具列表 */
  disabled: string[];
  /** 工具超时配置（秒） */
  timeout: number;
  /** 工具重试配置 */
  retry: RetryConfig;
  /** 工具验证配置 */
  validation: ValidationConfig;
}

/**
 * 资源配置
 */
export interface ResourcesConfig {
  /** 启用的资源列表 */
  enabled: string[];
  /** 资源订阅配置 */
  subscription: {
    enabled: boolean;
    maxSubscriptions: number;
  };
}

/**
 * 提示配置
 */
export interface PromptsConfig {
  /** 启用的提示列表 */
  enabled: string[];
  /** 提示模板目录 */
  templateDir: string;
}

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxAttempts: number;
  /** 初始延迟（毫秒） */
  initialDelay: number;
  /** 最大延迟（毫秒） */
  maxDelay: number;
  /** 退避因子 */
  backoffFactor: number;
  /** 是否使用抖动 */
  jitter: boolean;
}

/**
 * 验证配置
 */
export interface ValidationConfig {
  /** 是否启用严格验证 */
  strict: boolean;
  /** 是否允许额外属性 */
  allowExtraProperties: boolean;
  /** 自定义验证器 */
  customValidators: Record<string, any>;
}

/**
 * 日志配置
 */
export interface LoggingConfig {
  /** 日志级别 */
  level: LogLevel;
  /** 日志格式 */
  format: 'json' | 'text';
  /** 日志输出 */
  output: LogOutput[];
  /** 是否启用结构化日志 */
  structured: boolean;
  /** 时间戳格式 */
  timestampFormat: string;
  /** 是否包含堆栈跟踪 */
  includeStackTrace: boolean;
  /** 最大日志文件大小（字节） */
  maxFileSize: number;
  /** 最大日志文件数量 */
  maxFiles: number;
  /** 日志轮转配置 */
  rotation: LogRotationConfig;
}

/**
 * 日志输出配置
 */
export interface LogOutput {
  /** 输出类型 */
  type: 'console' | 'file' | 'syslog' | 'http';
  /** 输出级别 */
  level: LogLevel;
  /** 输出配置 */
  options: Record<string, any>;
}

/**
 * 日志轮转配置
 */
export interface LogRotationConfig {
  /** 是否启用日志轮转 */
  enabled: boolean;
  /** 轮转间隔 */
  interval: 'daily' | 'weekly' | 'monthly';
  /** 保留天数 */
  maxAge: number;
  /** 压缩旧日志 */
  compress: boolean;
}

/**
 * 安全配置
 */
export interface SecurityConfig {
  /** 访问控制配置 */
  accessControl: AccessControlConfig;
  /** 文件验证配置 */
  fileValidation: FileValidationConfig;
  /** 速率限制配置 */
  rateLimit: RateLimitConfig;
  /** CORS配置 */
  cors?: CORSConfig;
  /** 加密配置 */
  encryption?: EncryptionConfig;
}

/**
 * 访问控制配置
 */
export interface AccessControlConfig {
  /** 是否启用访问控制 */
  enabled: boolean;
  /** 允许的IP地址列表 */
  allowedIPs?: string[];
  /** 禁止的IP地址列表 */
  blockedIPs?: string[];
  /** 允许的用户代理 */
  allowedUserAgents?: string[];
  /** 最大并发连接数 */
  maxConcurrentConnections: number;
}

/**
 * 文件验证配置
 */
export interface FileValidationConfig {
  /** 最大文件大小（字节） */
  maxFileSize: number;
  /** 允许的文件类型 */
  allowedMimeTypes: string[];
  /** 禁止的文件扩展名 */
  blockedExtensions: string[];
  /** 是否检查文件内容 */
  checkContent: boolean;
  /** 病毒扫描配置 */
  virusScanning?: {
    enabled: boolean;
    engine: string;
    maxScanSize: number;
  };
}

/**
 * 速率限制配置
 */
export interface RateLimitConfig {
  /** 是否启用速率限制 */
  enabled: boolean;
  /** 请求窗口大小（秒） */
  windowSize: number;
  /** 最大请求数 */
  maxRequests: number;
  /** 是否跳过成功请求 */
  skipSuccessfulRequests: boolean;
  /** 是否跳过失败请求 */
  skipFailedRequests: boolean;
  /** 自定义限制规则 */
  customRules: Record<string, {
    windowSize: number;
    maxRequests: number;
  }>;
}

/**
 * CORS配置
 */
export interface CORSConfig {
  /** 是否启用CORS */
  enabled: boolean;
  /** 允许的源 */
  allowedOrigins: string[];
  /** 允许的方法 */
  allowedMethods: string[];
  /** 允许的头部 */
  allowedHeaders: string[];
  /** 暴露的头部 */
  exposedHeaders: string[];
  /** 是否允许凭证 */
  allowCredentials: boolean;
  /** 预检请求缓存时间 */
  maxAge: number;
}

/**
 * 加密配置
 */
export interface EncryptionConfig {
  /** 是否启用加密 */
  enabled: boolean;
  /** 加密算法 */
  algorithm: string;
  /** 密钥长度 */
  keyLength: number;
  /** 密钥轮转间隔（天） */
  keyRotationInterval: number;
}

/**
 * 性能配置
 */
export interface PerformanceConfig {
  /** 连接池配置 */
  connectionPool: ConnectionPoolConfig;
  /** 超时配置 */
  timeouts: TimeoutConfig;
  /** 内存配置 */
  memory: MemoryConfig;
  /** 并发配置 */
  concurrency: ConcurrencyConfig;
  /** 优化配置 */
  optimization: OptimizationConfig;
}

/**
 * 连接池配置
 */
export interface ConnectionPoolConfig {
  /** 最小连接数 */
  minConnections: number;
  /** 最大连接数 */
  maxConnections: number;
  /** 连接空闲超时（毫秒） */
  idleTimeout: number;
  /** 连接验证间隔（毫秒） */
  validationInterval: number;
  /** 是否测试连接 */
  testOnBorrow: boolean;
}

/**
 * 超时配置
 */
export interface TimeoutConfig {
  /** 连接超时（毫秒） */
  connection: number;
  /** 请求超时（毫秒） */
  request: number;
  /** 响应超时（毫秒） */
  response: number;
  /** 上传超时（毫秒） */
  upload: number;
  /** 下载超时（毫秒） */
  download: number;
}

/**
 * 内存配置
 */
export interface MemoryConfig {
  /** 最大堆内存（字节） */
  maxHeapSize: number;
  /** 垃圾回收配置 */
  gc: {
    enabled: boolean;
    interval: number;
    threshold: number;
  };
  /** 内存监控配置 */
  monitoring: {
    enabled: boolean;
    interval: number;
    alertThreshold: number;
  };
}

/**
 * 并发配置
 */
export interface ConcurrencyConfig {
  /** 最大并发工具调用数 */
  maxConcurrentTools: number;
  /** 最大并发上传数 */
  maxConcurrentUploads: number;
  /** 最大并发下载数 */
  maxConcurrentDownloads: number;
  /** 队列配置 */
  queue: {
    maxSize: number;
    timeout: number;
    priority: boolean;
  };
}

/**
 * 优化配置
 */
export interface OptimizationConfig {
  /** 是否启用压缩 */
  compression: boolean;
  /** 是否启用缓存 */
  caching: boolean;
  /** 是否启用预加载 */
  preloading: boolean;
  /** 是否启用批处理 */
  batching: boolean;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 是否启用缓存 */
  enabled: boolean;
  /** 缓存类型 */
  type: 'memory' | 'redis' | 'file';
  /** 最大缓存大小（字节） */
  maxSize: number;
  /** 默认TTL（秒） */
  defaultTTL: number;
  /** 清理间隔（秒） */
  cleanupInterval: number;
  /** 缓存策略 */
  strategy: 'lru' | 'lfu' | 'fifo';
  /** Redis配置（如果使用Redis缓存） */
  redis?: {
    host: string;
    port: number;
    password?: string;
    database: number;
    keyPrefix: string;
  };
}

/**
 * 分片上传配置
 */
export interface MultipartConfig {
  /** 分片上传阈值（字节） */
  threshold: number;
  /** 默认分片大小（字节） */
  partSize: number;
  /** 最大分片数 */
  maxParts: number;
  /** 并发上传数 */
  concurrency: number;
  /** 上传超时（毫秒） */
  timeout: number;
  /** 重试配置 */
  retry: RetryConfig;
  /** 是否启用校验 */
  enableChecksum: boolean;
}

/**
 * 监控配置
 */
export interface MonitoringConfig {
  /** 是否启用监控 */
  enabled: boolean;
  /** 指标收集间隔（秒） */
  metricsInterval: number;
  /** 健康检查间隔（秒） */
  healthCheckInterval: number;
  /** 性能监控配置 */
  performance: {
    enabled: boolean;
    sampleRate: number;
    slowThreshold: number;
  };
  /** 错误监控配置 */
  errorTracking: {
    enabled: boolean;
    maxErrors: number;
    reportInterval: number;
  };
  /** 外部监控系统 */
  external?: {
    prometheus?: {
      enabled: boolean;
      port: number;
      path: string;
    };
    jaeger?: {
      enabled: boolean;
      endpoint: string;
      serviceName: string;
    };
  };
}

/**
 * 插件配置
 */
export interface PluginConfig {
  /** 是否启用插件系统 */
  enabled: boolean;
  /** 插件目录 */
  pluginDir: string;
  /** 自动加载插件 */
  autoLoad: boolean;
  /** 插件配置映射 */
  plugins: Record<string, PluginInstanceConfig>;
  /** 插件安全配置 */
  security: {
    sandboxed: boolean;
    allowedModules: string[];
    blockedModules: string[];
  };
}

/**
 * 插件实例配置
 */
export interface PluginInstanceConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 插件版本 */
  version: string;
  /** 插件配置 */
  config: Record<string, any>;
  /** 加载优先级 */
  priority: number;
}

/**
 * 环境配置
 */
export interface EnvironmentConfig {
  /** 环境类型 */
  type: 'development' | 'testing' | 'staging' | 'production';
  /** 调试模式 */
  debug: boolean;
  /** 详细模式 */
  verbose: boolean;
  /** 节点环境 */
  nodeEnv: string;
  /** 时区 */
  timezone: string;
  /** 语言 */
  locale: string;
  /** 临时目录 */
  tempDir: string;
  /** 工作目录 */
  workDir: string;
}

/**
 * 配置验证模式
 */
export interface ConfigValidationSchema {
  /** 必需字段 */
  required: string[];
  /** 字段类型映射 */
  types: Record<string, string>;
  /** 字段约束 */
  constraints: Record<string, any>;
  /** 自定义验证器 */
  validators: Record<string, (value: any) => boolean>;
}

/**
 * 配置变更事件
 */
export interface ConfigChangeEvent {
  /** 变更类型 */
  type: 'update' | 'reload' | 'validate';
  /** 变更路径 */
  path: string;
  /** 旧值 */
  oldValue: any;
  /** 新值 */
  newValue: any;
  /** 变更时间 */
  timestamp: Date;
  /** 变更来源 */
  source: string;
}

/**
 * 配置加载选项
 */
export interface ConfigLoadOptions {
  /** 配置文件路径 */
  configFile?: string | undefined;
  /** 环境变量前缀 */
  envPrefix?: string;
  /** 是否验证配置 */
  validate?: boolean;
  /** 是否监听配置变更 */
  watch?: boolean;
  /** 默认配置 */
  defaults?: Partial<AppConfig>;
  /** 配置覆盖 */
  overrides?: Partial<AppConfig>;
}