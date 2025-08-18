/**
 * 阿里云OSS MCP服务 - 配置模式定义
 * 
 * @fileoverview 定义配置验证模式和默认值
 * @author alioss-mcp team
 * @version 1.0.0
 */

import { z } from 'zod';
import { LogLevel } from '../types/index.js';

/**
 * OSS配置模式
 */
export const ossConfigSchema = z.object({
  accessKeyId: z.string().min(1, 'OSS Access Key ID is required'),
  accessKeySecret: z.string().min(1, 'OSS Access Key Secret is required'),
  bucket: z.string().min(1, 'OSS Bucket name is required'),
  region: z.string().min(1, 'OSS Region is required'),
  secure: z.boolean().default(true),
  timeout: z.number().min(1).max(3600).default(300), // 1秒到1小时
  internal: z.boolean().default(false),
  cname: z.string().optional(),
  isRequestPay: z.boolean().default(false),
  stsToken: z.string().optional()
});

/**
 * MCP配置模式
 */
export const mcpConfigSchema = z.object({
  name: z.string().default('aigroup-aliyunoss-mcp'),
  version: z.string().default('1.0.0'),
  description: z.string().default('阿里云OSS MCP服务器'),
  protocolVersion: z.string().default('2024-11-05'),
  capabilities: z.object({
    tools: z.object({
      listChanged: z.boolean().default(false)
    }).optional(),
    resources: z.object({
      subscribe: z.boolean().default(false),
      listChanged: z.boolean().default(false)
    }).optional(),
    prompts: z.object({
      listChanged: z.boolean().default(false)
    }).optional(),
    logging: z.boolean().default(false)
  }).default({}),
  tools: z.object({
    enabled: z.array(z.string()).default([
      'uploadFile',
      'downloadFile',
      'deleteObject',
      'deleteMultipleObjects',
      'listObjects',
      'getObjectUrl',
      'copyObject',
      'getObjectMeta',
      'putObjectACL',
      'getObjectACL',
      'multipartUpload',
      'initMultipartUpload',
      'uploadPart',
      'completeMultipartUpload',
      'abortMultipartUpload',
      'listUploads'
    ]),
    disabled: z.array(z.string()).default([]),
    timeout: z.number().min(1000).max(600000).default(30000), // 1秒到10分钟（毫秒）
    retry: z.object({
      maxAttempts: z.number().min(1).max(10).default(3),
      initialDelay: z.number().min(100).max(10000).default(1000),
      maxDelay: z.number().min(1000).max(60000).default(10000),
      backoffFactor: z.number().min(1).max(5).default(2),
      jitter: z.boolean().default(true)
    }).default({}),
    validation: z.object({
      strict: z.boolean().default(true),
      allowExtraProperties: z.boolean().default(false),
      customValidators: z.record(z.any()).default({})
    }).default({})
  }).default({})
});

/**
 * 日志配置模式
 */
export const loggingConfigSchema = z.object({
  level: z.nativeEnum(LogLevel).default(LogLevel.INFO),
  format: z.enum(['json', 'text']).default('json'),
  output: z.array(z.object({
    type: z.enum(['console', 'file', 'syslog', 'http']),
    level: z.nativeEnum(LogLevel),
    options: z.record(z.any()).default({})
  })).default([{ type: 'console', level: LogLevel.INFO, options: {} }]),
  structured: z.boolean().default(true),
  timestampFormat: z.string().default('ISO8601'),
  includeStackTrace: z.boolean().default(true),
  maxFileSize: z.number().min(1024).default(10 * 1024 * 1024), // 10MB
  maxFiles: z.number().min(1).default(5),
  rotation: z.object({
    enabled: z.boolean().default(false),
    interval: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
    maxAge: z.number().min(1).default(30),
    compress: z.boolean().default(true)
  }).default({})
});

/**
 * 安全配置模式
 */
export const securityConfigSchema = z.object({
  accessControl: z.object({
    enabled: z.boolean().default(false),
    allowedIPs: z.array(z.string()).optional(),
    blockedIPs: z.array(z.string()).optional(),
    allowedUserAgents: z.array(z.string()).optional(),
    maxConcurrentConnections: z.number().min(1).default(100)
  }).default({}),
  fileValidation: z.object({
    maxFileSize: z.number().min(1024).default(100 * 1024 * 1024), // 100MB
    allowedMimeTypes: z.array(z.string()).default([
      'image/*',
      'text/*',
      'application/pdf',
      'application/json',
      'application/xml',
      'video/*',
      'audio/*'
    ]),
    blockedExtensions: z.array(z.string()).default([
      '.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.js'
    ]),
    checkContent: z.boolean().default(false),
    virusScanning: z.object({
      enabled: z.boolean().default(false),
      engine: z.string().default('clamav'),
      maxScanSize: z.number().default(50 * 1024 * 1024) // 50MB
    }).optional()
  }).default({}),
  rateLimit: z.object({
    enabled: z.boolean().default(true),
    windowSize: z.number().min(1).default(60), // 60秒
    maxRequests: z.number().min(1).default(100),
    skipSuccessfulRequests: z.boolean().default(false),
    skipFailedRequests: z.boolean().default(false),
    customRules: z.record(z.object({
      windowSize: z.number().min(1),
      maxRequests: z.number().min(1)
    })).default({})
  }).default({})
});

/**
 * 性能配置模式
 */
export const performanceConfigSchema = z.object({
  connectionPool: z.object({
    minConnections: z.number().min(1).default(5),
    maxConnections: z.number().min(1).default(50),
    idleTimeout: z.number().min(1000).default(300000), // 5分钟
    validationInterval: z.number().min(1000).default(30000), // 30秒
    testOnBorrow: z.boolean().default(true)
  }).default({}),
  timeouts: z.object({
    connection: z.number().min(1000).default(30000), // 30秒
    request: z.number().min(1000).default(60000), // 60秒
    response: z.number().min(1000).default(60000), // 60秒
    upload: z.number().min(1000).default(300000), // 5分钟
    download: z.number().min(1000).default(300000) // 5分钟
  }).default({}),
  memory: z.object({
    maxHeapSize: z.number().min(1024 * 1024).default(512 * 1024 * 1024), // 512MB
    gc: z.object({
      enabled: z.boolean().default(true),
      interval: z.number().min(1000).default(60000), // 60秒
      threshold: z.number().min(0.5).max(0.95).default(0.8) // 80%
    }).default({}),
    monitoring: z.object({
      enabled: z.boolean().default(true),
      interval: z.number().min(1000).default(30000), // 30秒
      alertThreshold: z.number().min(0.5).max(0.95).default(0.9) // 90%
    }).default({})
  }).default({}),
  concurrency: z.object({
    maxConcurrentTools: z.number().min(1).default(10),
    maxConcurrentUploads: z.number().min(1).default(5),
    maxConcurrentDownloads: z.number().min(1).default(10),
    queue: z.object({
      maxSize: z.number().min(1).default(100),
      timeout: z.number().min(1000).default(30000),
      priority: z.boolean().default(false)
    }).default({})
  }).default({}),
  optimization: z.object({
    compression: z.boolean().default(true),
    caching: z.boolean().default(true),
    preloading: z.boolean().default(false),
    batching: z.boolean().default(true)
  }).default({})
});

/**
 * 缓存配置模式
 */
export const cacheConfigSchema = z.object({
  enabled: z.boolean().default(true),
  type: z.enum(['memory', 'redis', 'file']).default('memory'),
  maxSize: z.number().min(1024).default(100 * 1024 * 1024), // 100MB
  defaultTTL: z.number().min(1).default(3600), // 1小时
  cleanupInterval: z.number().min(1).default(300), // 5分钟
  strategy: z.enum(['lru', 'lfu', 'fifo']).default('lru'),
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().min(1).max(65535).default(6379),
    password: z.string().optional(),
    database: z.number().min(0).default(0),
    keyPrefix: z.string().default('alioss-mcp:')
  }).optional()
});

/**
 * 分片上传配置模式
 */
export const multipartConfigSchema = z.object({
  threshold: z.number().min(1024).default(10 * 1024 * 1024), // 10MB
  partSize: z.number().min(1024).default(5 * 1024 * 1024), // 5MB
  maxParts: z.number().min(1).max(10000).default(1000),
  concurrency: z.number().min(1).default(3),
  timeout: z.number().min(1000).default(300000), // 5分钟
  retry: z.object({
    maxAttempts: z.number().min(1).max(10).default(3),
    initialDelay: z.number().min(100).max(10000).default(1000),
    maxDelay: z.number().min(1000).max(60000).default(10000),
    backoffFactor: z.number().min(1).max(5).default(2),
    jitter: z.boolean().default(true)
  }).default({}),
  enableChecksum: z.boolean().default(true)
});

/**
 * 监控配置模式
 */
export const monitoringConfigSchema = z.object({
  enabled: z.boolean().default(true),
  metricsInterval: z.number().min(1000).default(30000), // 30秒
  healthCheckInterval: z.number().min(1000).default(60000), // 60秒
  performance: z.object({
    enabled: z.boolean().default(true),
    sampleRate: z.number().min(0).max(1).default(1.0), // 100%
    slowThreshold: z.number().min(100).default(5000) // 5秒
  }).default({}),
  errorTracking: z.object({
    enabled: z.boolean().default(true),
    maxErrors: z.number().min(1).default(100),
    reportInterval: z.number().min(1000).default(60000) // 60秒
  }).default({}),
  external: z.object({
    prometheus: z.object({
      enabled: z.boolean().default(false),
      port: z.number().min(1).max(65535).default(9090),
      path: z.string().default('/metrics')
    }).optional(),
    jaeger: z.object({
      enabled: z.boolean().default(false),
      endpoint: z.string().default('http://localhost:14268/api/traces'),
      serviceName: z.string().default('alioss-mcp')
    }).optional()
  }).optional()
});

/**
 * 插件配置模式
 */
export const pluginConfigSchema = z.object({
  enabled: z.boolean().default(false),
  pluginDir: z.string().default('./plugins'),
  autoLoad: z.boolean().default(true),
  plugins: z.record(z.object({
    enabled: z.boolean().default(true),
    version: z.string().default('latest'),
    config: z.record(z.any()).default({}),
    priority: z.number().default(100)
  })).default({}),
  security: z.object({
    sandboxed: z.boolean().default(true),
    allowedModules: z.array(z.string()).default(['fs', 'path', 'crypto']),
    blockedModules: z.array(z.string()).default(['child_process', 'cluster'])
  }).default({})
});

/**
 * 环境配置模式
 */
export const environmentConfigSchema = z.object({
  type: z.enum(['development', 'testing', 'staging', 'production']).default('development'),
  debug: z.boolean().default(false),
  verbose: z.boolean().default(false),
  nodeEnv: z.string().default(process.env.NODE_ENV || 'development'),
  timezone: z.string().default('UTC'),
  locale: z.string().default('en-US'),
  tempDir: z.string().default('/tmp'),
  workDir: z.string().default(process.cwd())
});

/**
 * 完整应用配置模式
 */
export const appConfigSchema = z.object({
  oss: ossConfigSchema,
  mcp: mcpConfigSchema,
  logging: loggingConfigSchema,
  security: securityConfigSchema,
  performance: performanceConfigSchema,
  cache: cacheConfigSchema,
  multipart: multipartConfigSchema,
  monitoring: monitoringConfigSchema,
  plugins: pluginConfigSchema,
  environment: environmentConfigSchema
});

/**
 * 配置类型推断
 */
export type AppConfigType = z.infer<typeof appConfigSchema>;
export type OSSConfigType = z.infer<typeof ossConfigSchema>;
export type MCPConfigType = z.infer<typeof mcpConfigSchema>;
export type LoggingConfigType = z.infer<typeof loggingConfigSchema>;
export type SecurityConfigType = z.infer<typeof securityConfigSchema>;
export type PerformanceConfigType = z.infer<typeof performanceConfigSchema>;
export type CacheConfigType = z.infer<typeof cacheConfigSchema>;
export type MultipartConfigType = z.infer<typeof multipartConfigSchema>;
export type MonitoringConfigType = z.infer<typeof monitoringConfigSchema>;
export type PluginConfigType = z.infer<typeof pluginConfigSchema>;
export type EnvironmentConfigType = z.infer<typeof environmentConfigSchema>;

/**
 * 默认配置
 */
export const defaultConfig: AppConfigType = {
  oss: {
    accessKeyId: '',
    accessKeySecret: '',
    bucket: '',
    region: '',
    secure: true,
    timeout: 300,
    internal: false,
    isRequestPay: false
  },
  mcp: {
    name: 'aigroup-aliyunoss-mcp',
    version: '1.0.0',
    description: '阿里云OSS MCP服务器',
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: { listChanged: false },
      logging: false
    },
    tools: {
      enabled: [
        'uploadFile',
        'downloadFile',
        'deleteObject',
        'deleteMultipleObjects',
        'listObjects',
        'getObjectUrl',
        'copyObject',
        'getObjectMeta',
        'putObjectACL',
        'getObjectACL',
        'multipartUpload',
        'initMultipartUpload',
        'uploadPart',
        'completeMultipartUpload',
        'abortMultipartUpload',
        'listUploads'
      ],
      disabled: [],
      timeout: 30000,
      retry: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffFactor: 2,
        jitter: true
      },
      validation: {
        strict: true,
        allowExtraProperties: false,
        customValidators: {}
      }
    }
  },
  logging: {
    level: LogLevel.INFO,
    format: 'json',
    output: [{ type: 'console', level: LogLevel.INFO, options: {} }],
    structured: true,
    timestampFormat: 'ISO8601',
    includeStackTrace: true,
    maxFileSize: 10 * 1024 * 1024,
    maxFiles: 5,
    rotation: {
      enabled: false,
      interval: 'daily',
      maxAge: 30,
      compress: true
    }
  },
  security: {
    accessControl: {
      enabled: false,
      maxConcurrentConnections: 100
    },
    fileValidation: {
      maxFileSize: 100 * 1024 * 1024,
      allowedMimeTypes: [
        'image/*',
        'text/*',
        'application/pdf',
        'application/json',
        'application/xml',
        'video/*',
        'audio/*'
      ],
      blockedExtensions: [
        '.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.js'
      ],
      checkContent: false
    },
    rateLimit: {
      enabled: true,
      windowSize: 60,
      maxRequests: 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      customRules: {}
    }
  },
  performance: {
    connectionPool: {
      minConnections: 5,
      maxConnections: 50,
      idleTimeout: 300000,
      validationInterval: 30000,
      testOnBorrow: true
    },
    timeouts: {
      connection: 30000,
      request: 60000,
      response: 60000,
      upload: 300000,
      download: 300000
    },
    memory: {
      maxHeapSize: 512 * 1024 * 1024,
      gc: {
        enabled: true,
        interval: 60000,
        threshold: 0.8
      },
      monitoring: {
        enabled: true,
        interval: 30000,
        alertThreshold: 0.9
      }
    },
    concurrency: {
      maxConcurrentTools: 10,
      maxConcurrentUploads: 5,
      maxConcurrentDownloads: 10,
      queue: {
        maxSize: 100,
        timeout: 30000,
        priority: false
      }
    },
    optimization: {
      compression: true,
      caching: true,
      preloading: false,
      batching: true
    }
  },
  cache: {
    enabled: true,
    type: 'memory',
    maxSize: 100 * 1024 * 1024,
    defaultTTL: 3600,
    cleanupInterval: 300,
    strategy: 'lru'
  },
  multipart: {
    threshold: 10 * 1024 * 1024,
    partSize: 5 * 1024 * 1024,
    maxParts: 1000,
    concurrency: 3,
    timeout: 300000,
    retry: {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2,
      jitter: true
    },
    enableChecksum: true
  },
  monitoring: {
    enabled: true,
    metricsInterval: 30000,
    healthCheckInterval: 60000,
    performance: {
      enabled: true,
      sampleRate: 1.0,
      slowThreshold: 5000
    },
    errorTracking: {
      enabled: true,
      maxErrors: 100,
      reportInterval: 60000
    }
  },
  plugins: {
    enabled: false,
    pluginDir: './plugins',
    autoLoad: true,
    plugins: {},
    security: {
      sandboxed: true,
      allowedModules: ['fs', 'path', 'crypto'],
      blockedModules: ['child_process', 'cluster']
    }
  },
  environment: {
    type: 'development',
    debug: false,
    verbose: false,
    nodeEnv: process.env.NODE_ENV || 'development',
    timezone: 'UTC',
    locale: 'en-US',
    tempDir: '/tmp',
    workDir: process.cwd()
  }
};