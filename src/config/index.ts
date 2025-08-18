/**
 * 阿里云OSS MCP服务 - 配置管理模块导出
 * 
 * @fileoverview 配置管理相关功能的统一导出
 * @author alioss-mcp team
 * @version 1.0.0
 */

// 导出配置管理器
export { 
  ConfigManager, 
  createConfigManager, 
  getGlobalConfig, 
  setGlobalConfig 
} from './config.js';

// 导出配置模式和默认配置
export {
  appConfigSchema,
  ossConfigSchema,
  mcpConfigSchema,
  loggingConfigSchema,
  securityConfigSchema,
  performanceConfigSchema,
  cacheConfigSchema,
  multipartConfigSchema,
  monitoringConfigSchema,
  pluginConfigSchema,
  environmentConfigSchema,
  defaultConfig
} from './schema.js';

// 导出配置模式类型
export type {
  AppConfigType,
  OSSConfigType,
  MCPConfigType,
  LoggingConfigType,
  SecurityConfigType,
  PerformanceConfigType,
  CacheConfigType,
  MultipartConfigType,
  MonitoringConfigType,
  PluginConfigType,
  EnvironmentConfigType
} from './schema.js';

// 导出配置相关类型
export type {
  AppConfig,
  ConfigChangeEvent,
  ConfigLoadOptions,
  ConfigValidationSchema,
  MCPConfig,
  LoggingConfig,
  SecurityConfig,
  PerformanceConfig,
  MultipartConfig,
  MonitoringConfig,
  PluginConfig,
  EnvironmentConfig,
  ToolsConfig,
  RetryConfig,
  ValidationConfig,
  AccessControlConfig,
  FileValidationConfig,
  RateLimitConfig,
  ConnectionPoolConfig,
  TimeoutConfig,
  MemoryConfig,
  ConcurrencyConfig,
  OptimizationConfig,
  CacheConfig,
  PluginInstanceConfig
} from '../types/config.js';