/**
 * 阿里云OSS MCP服务 - 配置管理器
 * 
 * @fileoverview 配置加载、验证和管理的核心实现
 * @author aigroup-aliyunoss-mcp team
 * @version 1.0.0
 */

import { readFileSync, existsSync, watchFile, unwatchFile } from 'fs';
import { resolve } from 'path';
import { EventEmitter } from 'events';
import {
  appConfigSchema,
  defaultConfig,
  AppConfigType,
  OSSConfigType,
  MCPConfigType
} from './schema.js';
import {
  ConfigChangeEvent,
  ConfigLoadOptions
} from '../types/config.js';
import { LogLevel } from '../types/index.js';
import { MCPError, ErrorCode } from '../types/index.js';

/**
 * 配置管理器
 */
export class ConfigManager extends EventEmitter {
  private config: AppConfigType;
  private configFile?: string | undefined;
  private watchEnabled: boolean;
  private loaded: boolean;

  constructor(options: ConfigLoadOptions = {}) {
    super();
    
    this.config = { ...defaultConfig };
    this.configFile = options.configFile;
    this.watchEnabled = options.watch || false;
    this.loaded = false;

    // 应用默认配置
    if (options.defaults) {
      this.config = this.mergeConfig(this.config, options.defaults);
    }
  }

  /**
   * 加载配置
   */
  async loadConfig(): Promise<AppConfigType> {
    try {
      console.log('[Config] 开始加载配置...');
      
      // 1. 加载默认配置
      let config = { ...defaultConfig };
      
      // 2. 加载配置文件
      if (this.configFile && existsSync(this.configFile)) {
        console.log(`[Config] 加载配置文件: ${this.configFile}`);
        const fileConfig = this.loadConfigFile(this.configFile);
        config = this.mergeConfig(config, fileConfig);
      }
      
      // 3. 加载环境变量
      console.log('[Config] 加载环境变量配置...');
      const envConfig = this.loadEnvironmentConfig();
      config = this.mergeConfig(config, envConfig);
      
      // 4. 验证配置
      console.log('[Config] 验证配置...');
      this.config = this.validateConfig(config);
      
      // 5. 启用配置文件监听
      if (this.watchEnabled && this.configFile) {
        this.enableConfigWatch();
      }
      
      this.loaded = true;
      console.log('[Config] 配置加载完成');
      
      this.emit('config:loaded', this.config);
      return this.config;
      
    } catch (error) {
      console.error('[Config] 配置加载失败:', error);
      throw new MCPError(
        ErrorCode.CONFIG_INVALID,
        `配置加载失败: ${error instanceof Error ? error.message : String(error)}`,
        { error }
      );
    }
  }

  /**
   * 验证配置
   */
  validateConfig(config?: Partial<AppConfigType>): AppConfigType {
    try {
      const configToValidate = config || this.config;
      const result = appConfigSchema.parse(configToValidate);
      
      // 额外的业务逻辑验证
      this.performBusinessValidation(result);
      
      return result;
    } catch (error) {
      console.error('[Config] 配置验证失败:', error);
      throw new MCPError(
        ErrorCode.CONFIG_INVALID,
        `配置验证失败: ${error instanceof Error ? error.message : String(error)}`,
        { error, config }
      );
    }
  }

  /**
   * 获取完整配置
   */
  getConfig(): AppConfigType {
    if (!this.loaded) {
      throw new MCPError(
        ErrorCode.CONFIG_MISSING,
        '配置尚未加载，请先调用 loadConfig()'
      );
    }
    return { ...this.config };
  }

  /**
   * 获取OSS配置
   */
  getOSSConfig(): OSSConfigType {
    return this.getConfig().oss;
  }

  /**
   * 获取MCP配置
   */
  getMCPConfig(): MCPConfigType {
    return this.getConfig().mcp;
  }

  /**
   * 获取分片上传配置
   */
  getMultipartConfig() {
    return this.getConfig().multipart;
  }

  /**
   * 获取安全配置
   */
  getSecurityConfig() {
    return this.getConfig().security;
  }

  /**
   * 获取性能配置
   */
  getPerformanceConfig() {
    return this.getConfig().performance;
  }

  /**
   * 获取日志配置
   */
  getLoggingConfig() {
    return this.getConfig().logging;
  }

  /**
   * 获取缓存配置
   */
  getCacheConfig() {
    return this.getConfig().cache;
  }

  /**
   * 获取监控配置
   */
  getMonitoringConfig() {
    return this.getConfig().monitoring;
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<AppConfigType>): void {
    try {
      const oldConfig = { ...this.config };
      const newConfig = this.mergeConfig(this.config, updates);
      const validatedConfig = this.validateConfig(newConfig);
      
      this.config = validatedConfig;
      
      const changeEvent: ConfigChangeEvent = {
        type: 'update',
        path: 'root',
        oldValue: oldConfig,
        newValue: this.config,
        timestamp: new Date(),
        source: 'api'
      };
      
      this.emit('config:changed', changeEvent);
      console.log('[Config] 配置已更新');
      
    } catch (error) {
      console.error('[Config] 配置更新失败:', error);
      throw new MCPError(
        ErrorCode.CONFIG_INVALID,
        `配置更新失败: ${error instanceof Error ? error.message : String(error)}`,
        { updates, error }
      );
    }
  }

  /**
   * 重新加载配置
   */
  async reloadConfig(): Promise<AppConfigType> {
    try {
      console.log('[Config] 重新加载配置...');
      const oldConfig = { ...this.config };
      
      await this.loadConfig();
      
      const changeEvent: ConfigChangeEvent = {
        type: 'reload',
        path: 'root',
        oldValue: oldConfig,
        newValue: this.config,
        timestamp: new Date(),
        source: 'reload'
      };
      
      this.emit('config:changed', changeEvent);
      return this.config;
      
    } catch (error) {
      console.error('[Config] 配置重新加载失败:', error);
      throw error;
    }
  }

  /**
   * 获取配置摘要
   */
  getConfigSummary(): Record<string, any> {
    const config = this.getConfig();
    
    return {
      loaded: this.loaded,
      environment: config.environment.type,
      debug: config.environment.debug,
      oss: {
        region: config.oss.region,
        bucket: config.oss.bucket,
        secure: config.oss.secure,
        timeout: config.oss.timeout
      },
      mcp: {
        name: config.mcp.name,
        version: config.mcp.version,
        enabledTools: config.mcp.tools.enabled.length,
        disabledTools: config.mcp.tools.disabled.length
      },
      logging: {
        level: config.logging.level,
        format: config.logging.format,
        structured: config.logging.structured
      },
      security: {
        accessControlEnabled: config.security.accessControl.enabled,
        rateLimitEnabled: config.security.rateLimit.enabled,
        maxFileSize: config.security.fileValidation.maxFileSize
      },
      performance: {
        maxConnections: config.performance.connectionPool.maxConnections,
        requestTimeout: config.performance.timeouts.request,
        maxConcurrentTools: config.performance.concurrency.maxConcurrentTools
      },
      cache: {
        enabled: config.cache.enabled,
        type: config.cache.type,
        maxSize: config.cache.maxSize
      },
      multipart: {
        threshold: config.multipart.threshold,
        partSize: config.multipart.partSize,
        concurrency: config.multipart.concurrency
      },
      monitoring: {
        enabled: config.monitoring.enabled,
        metricsInterval: config.monitoring.metricsInterval,
        performanceEnabled: config.monitoring.performance.enabled
      },
      plugins: {
        enabled: config.plugins.enabled,
        autoLoad: config.plugins.autoLoad,
        pluginCount: Object.keys(config.plugins.plugins).length
      }
    };
  }

  /**
   * 检查配置是否有效
   */
  isConfigValid(): boolean {
    try {
      this.validateConfig();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 销毁配置管理器
   */
  destroy(): void {
    if (this.watchEnabled && this.configFile) {
      this.disableConfigWatch();
    }
    this.removeAllListeners();
    console.log('[Config] 配置管理器已销毁');
  }

  /**
   * 加载配置文件
   */
  private loadConfigFile(filePath: string): Partial<AppConfigType> {
    try {
      const absolutePath = resolve(filePath);
      const content = readFileSync(absolutePath, 'utf-8');
      
      let config: any;
      if (filePath.endsWith('.json')) {
        config = JSON.parse(content);
      } else if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
        // 动态导入JS配置文件
        delete require.cache[absolutePath];
        config = require(absolutePath);
        if (config.default) {
          config = config.default;
        }
      } else {
        throw new Error(`不支持的配置文件格式: ${filePath}`);
      }
      
      return config;
    } catch (error) {
      throw new MCPError(
        ErrorCode.CONFIG_INVALID,
        `加载配置文件失败: ${error instanceof Error ? error.message : String(error)}`,
        { filePath, error }
      );
    }
  }

  /**
   * 加载环境变量配置
   */
  private loadEnvironmentConfig(): Partial<AppConfigType> {
    const envConfig: any = {};
    
    // OSS配置
    if (process.env.OSS_ACCESS_KEY_ID) {
      envConfig.oss = envConfig.oss || {};
      envConfig.oss.accessKeyId = process.env.OSS_ACCESS_KEY_ID;
    }
    
    if (process.env.OSS_ACCESS_KEY_SECRET) {
      envConfig.oss = envConfig.oss || {};
      envConfig.oss.accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
    }
    
    if (process.env.OSS_BUCKET) {
      envConfig.oss = envConfig.oss || {};
      envConfig.oss.bucket = process.env.OSS_BUCKET;
    }
    
    if (process.env.OSS_REGION) {
      envConfig.oss = envConfig.oss || {};
      envConfig.oss.region = process.env.OSS_REGION;
    }
    
    if (process.env.OSS_SECURE) {
      envConfig.oss = envConfig.oss || {};
      envConfig.oss.secure = process.env.OSS_SECURE === 'true';
    }
    
    if (process.env.OSS_TIMEOUT) {
      envConfig.oss = envConfig.oss || {};
      envConfig.oss.timeout = parseInt(process.env.OSS_TIMEOUT, 10);
    }
    
    if (process.env.OSS_INTERNAL) {
      envConfig.oss = envConfig.oss || {};
      envConfig.oss.internal = process.env.OSS_INTERNAL === 'true';
    }
    
    if (process.env.OSS_CNAME) {
      envConfig.oss = envConfig.oss || {};
      envConfig.oss.cname = process.env.OSS_CNAME;
    }
    
    // 日志配置
    if (process.env.MCP_LOG_LEVEL) {
      envConfig.logging = envConfig.logging || {};
      envConfig.logging.level = process.env.MCP_LOG_LEVEL as LogLevel;
    }
    
    if (process.env.MCP_LOG_FORMAT) {
      envConfig.logging = envConfig.logging || {};
      envConfig.logging.format = process.env.MCP_LOG_FORMAT as 'json' | 'text';
    }
    
    // 安全配置
    if (process.env.MCP_MAX_FILE_SIZE) {
      envConfig.security = envConfig.security || {};
      envConfig.security.fileValidation = envConfig.security.fileValidation || {};
      envConfig.security.fileValidation.maxFileSize = parseInt(process.env.MCP_MAX_FILE_SIZE, 10) * 1024 * 1024; // MB转字节
    }
    
    // 分片上传配置
    if (process.env.MULTIPART_THRESHOLD) {
      envConfig.multipart = envConfig.multipart || {};
      envConfig.multipart.threshold = parseInt(process.env.MULTIPART_THRESHOLD, 10) * 1024 * 1024; // MB转字节
    }
    
    if (process.env.MULTIPART_PART_SIZE) {
      envConfig.multipart = envConfig.multipart || {};
      envConfig.multipart.partSize = parseInt(process.env.MULTIPART_PART_SIZE, 10) * 1024 * 1024; // MB转字节
    }
    
    if (process.env.MULTIPART_CONCURRENCY) {
      envConfig.multipart = envConfig.multipart || {};
      envConfig.multipart.concurrency = parseInt(process.env.MULTIPART_CONCURRENCY, 10);
    }
    
    // 环境配置
    if (process.env.NODE_ENV) {
      envConfig.environment = envConfig.environment || {};
      envConfig.environment.type = process.env.NODE_ENV as any;
      envConfig.environment.nodeEnv = process.env.NODE_ENV;
    }
    
    if (process.env.DEBUG) {
      envConfig.environment = envConfig.environment || {};
      envConfig.environment.debug = process.env.DEBUG === 'true' || process.env.DEBUG === '1';
    }
    
    if (process.env.VERBOSE) {
      envConfig.environment = envConfig.environment || {};
      envConfig.environment.verbose = process.env.VERBOSE === 'true' || process.env.VERBOSE === '1';
    }
    
    return envConfig;
  }

  /**
   * 合并配置对象
   */
  private mergeConfig(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.mergeConfig(target[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }

  /**
   * 执行业务逻辑验证
   */
  private performBusinessValidation(config: AppConfigType): void {
    // 检查OSS必需配置
    if (!config.oss.accessKeyId || !config.oss.accessKeySecret) {
      throw new Error('OSS访问密钥配置不完整');
    }
    
    if (!config.oss.bucket || !config.oss.region) {
      throw new Error('OSS存储桶和地域配置不完整');
    }
    
    // 检查分片上传配置合理性
    if (config.multipart.partSize > config.multipart.threshold) {
      throw new Error('分片大小不能大于分片上传阈值');
    }
    
    // 检查超时配置合理性
    if (config.performance.timeouts.connection > config.performance.timeouts.request) {
      console.warn('[Config] 警告: 连接超时大于请求超时，可能导致意外行为');
    }
    
    // 检查并发配置合理性
    if (config.performance.concurrency.maxConcurrentUploads > config.performance.connectionPool.maxConnections) {
      console.warn('[Config] 警告: 最大并发上传数大于最大连接数');
    }
    
    // 检查缓存配置
    if (config.cache.enabled && config.cache.type === 'redis' && !config.cache.redis) {
      throw new Error('启用Redis缓存时必须提供Redis配置');
    }
  }

  /**
   * 启用配置文件监听
   */
  private enableConfigWatch(): void {
    if (!this.configFile) return;
    
    console.log(`[Config] 启用配置文件监听: ${this.configFile}`);
    
    watchFile(this.configFile, { interval: 5000 }, async (curr, prev) => {
      if (curr.mtime !== prev.mtime) {
        console.log('[Config] 检测到配置文件变更，重新加载...');
        try {
          await this.reloadConfig();
        } catch (error) {
          console.error('[Config] 配置文件重新加载失败:', error);
          this.emit('config:error', error);
        }
      }
    });
  }

  /**
   * 禁用配置文件监听
   */
  private disableConfigWatch(): void {
    if (!this.configFile) return;
    
    console.log(`[Config] 禁用配置文件监听: ${this.configFile}`);
    unwatchFile(this.configFile);
  }
}

/**
 * 创建配置管理器实例
 */
export function createConfigManager(options?: ConfigLoadOptions): ConfigManager {
  return new ConfigManager(options);
}

/**
 * 全局配置管理器实例
 */
let globalConfigManager: ConfigManager | null = null;

/**
 * 获取全局配置管理器
 */
export function getGlobalConfig(): ConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = createConfigManager();
  }
  return globalConfigManager;
}

/**
 * 设置全局配置管理器
 */
export function setGlobalConfig(manager: ConfigManager): void {
  globalConfigManager = manager;
}