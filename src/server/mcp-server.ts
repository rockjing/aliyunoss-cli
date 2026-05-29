/**
 * 阿里云OSS MCP服务 - MCP服务器核心
 * 
 * @fileoverview MCP服务器的核心实现
 * @author aigroup-aliyunoss-mcp team
 * @version 1.0.0
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

import { ConfigManager } from '../config/index.js';
import { redactSensitiveDetails } from '../security/redaction.js';
import { OSSStorageService } from '../storage/index.js';
import { allTools } from '../tools/index.js';
import type { ToolDefinition } from '../types/index.js';
import {
  MCPError,
  ErrorCode as AppErrorCode,
  ToolContext,
  HealthReport,
  HealthStatus
} from '../types/index.js';

/**
 * MCP服务器类
 */
export class MCPServer extends EventEmitter {
  private server: Server;
  private configManager: ConfigManager;
  private storageService!: OSSStorageService;
  private logger: any;
  private tools: Map<string, ToolDefinition>;
  private initialized: boolean;
  private startTime: Date;

  constructor(configManager: ConfigManager, logger?: any) {
    super();
    
    this.configManager = configManager;
    this.logger = logger;
    this.tools = new Map();
    this.initialized = false;
    this.startTime = new Date();
    
    // 初始化MCP服务器
    this.server = new Server(
      {
        name: configManager.getMCPConfig().name,
        version: configManager.getMCPConfig().version,
        description: configManager.getMCPConfig().description
      },
      {
        capabilities: {
          tools: {
            listChanged: configManager.getMCPConfig().capabilities?.tools?.listChanged || false
          },
          logging: {}
        }
      }
    );

    this.log('info', 'MCP服务器实例创建完成', {
      name: configManager.getMCPConfig().name,
      version: configManager.getMCPConfig().version
    });
  }

  /**
   * 初始化服务器
   */
  async initialize(): Promise<void> {
    try {
      this.log('info', '开始初始化MCP服务器...');

      // 初始化存储服务
      await this.initializeStorage();

      // 注册工具
      await this.registerTools();

      // 设置服务器处理器
      this.setupServerHandlers();

      this.initialized = true;
      this.log('info', 'MCP服务器初始化完成');
      
      this.emit('initialized');
    } catch (error) {
      this.log('error', 'MCP服务器初始化失败', { error });
      throw new MCPError(
        AppErrorCode.INTERNAL_ERROR,
        `MCP服务器初始化失败: ${error instanceof Error ? error.message : String(error)}`,
        { error }
      );
    }
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      this.log('info', '启动MCP服务器...');

      // 创建stdio传输
      const transport = new StdioServerTransport();
      
      // 连接服务器和传输
      await this.server.connect(transport);

      this.log('info', 'MCP服务器启动成功', {
        tools: this.tools.size,
        transport: 'stdio'
      });

      this.emit('started');
    } catch (error) {
      this.log('error', 'MCP服务器启动失败', { error });
      throw new MCPError(
        AppErrorCode.INTERNAL_ERROR,
        `MCP服务器启动失败: ${error instanceof Error ? error.message : String(error)}`,
        { error }
      );
    }
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    try {
      this.log('info', '停止MCP服务器...');

      await this.server.close();

      this.log('info', 'MCP服务器已停止');
      this.emit('stopped');
    } catch (error) {
      this.log('error', 'MCP服务器停止失败', { error });
      throw new MCPError(
        AppErrorCode.INTERNAL_ERROR,
        `MCP服务器停止失败: ${error instanceof Error ? error.message : String(error)}`,
        { error }
      );
    }
  }

  /**
   * 获取健康状态
   */
  async getHealthStatus(): Promise<HealthReport> {
    const now = new Date();
    const uptime = now.getTime() - this.startTime.getTime();

    // 检查配置
    const configCheck = this.checkConfigHealth();
    
    // 检查OSS连接
    const ossCheck = await this.checkOSSHealth();
    
    // 检查内存使用
    const memoryCheck = this.checkMemoryHealth();

    // 确定整体状态
    const checks = [configCheck, ossCheck, memoryCheck];
    const unhealthyChecks = checks.filter(check => check.status === HealthStatus.UNHEALTHY);
    const degradedChecks = checks.filter(check => check.status === HealthStatus.DEGRADED);

    let overallStatus: HealthStatus;
    if (unhealthyChecks.length > 0) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (degradedChecks.length > 0) {
      overallStatus = HealthStatus.DEGRADED;
    } else {
      overallStatus = HealthStatus.HEALTHY;
    }

    return {
      status: overallStatus,
      timestamp: now.toISOString(),
      version: this.configManager.getMCPConfig().version,
      uptime: Math.floor(uptime / 1000), // 秒
      checks: {
        config: configCheck,
        oss: ossCheck,
        memory: memoryCheck
      }
    };
  }

  /**
   * 初始化存储服务
   */
  private async initializeStorage(): Promise<void> {
    try {
      const ossConfigSource = this.configManager.getOSSRuntimeConfig();
      const ossConfig: any = {
        ...ossConfigSource
      };
      
      // 确保可选属性的正确处理
      if (!ossConfig.cname) {
        delete ossConfig.cname;
      }
      if (!ossConfig.stsToken) {
        delete ossConfig.stsToken;
      }
      
      this.storageService = new OSSStorageService(ossConfig, this.logger);
      
      // 测试连接
      const isConnected = await this.storageService.checkConnection();
      if (!isConnected) {
        throw new Error('OSS连接测试失败');
      }

      this.log('info', 'OSS存储服务初始化成功');
    } catch (error) {
      this.log('error', 'OSS存储服务初始化失败', { error });
      throw error;
    }
  }

  /**
   * 注册工具
   */
  private async registerTools(): Promise<void> {
    try {
      const enabledTools = this.configManager.getMCPConfig().tools.enabled;
      const disabledTools = this.configManager.getMCPConfig().tools.disabled;

      for (const tool of allTools) {
        // 检查工具是否被禁用
        if (disabledTools.includes(tool.name)) {
          this.log('debug', '跳过已禁用的工具', { toolName: tool.name });
          continue;
        }

        // 检查工具是否在启用列表中
        if (enabledTools.length > 0 && !enabledTools.includes(tool.name)) {
          this.log('debug', '跳过未启用的工具', { toolName: tool.name });
          continue;
        }

        this.tools.set(tool.name, tool);
        this.log('debug', '注册工具', { toolName: tool.name });
      }

      this.log('info', '工具注册完成', { 
        total: allTools.length,
        enabled: this.tools.size,
        disabled: allTools.length - this.tools.size
      });
    } catch (error) {
      this.log('error', '工具注册失败', { error });
      throw error;
    }
  }

  /**
   * 设置服务器处理器
   */
  private setupServerHandlers(): void {
    // 工具列表处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));

      this.log('debug', '返回工具列表', { count: tools.length });
      
      return { tools };
    });

    // 工具调用处理器
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const traceId = uuidv4();

      this.log('info', '收到工具调用请求', { 
        toolName: name, 
        traceId,
        arguments: this.sanitizeArguments(args)
      });

      try {
        // 检查工具是否存在
        const tool = this.tools.get(name);
        if (!tool) {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `工具不存在: ${name}`
          );
        }

        // 创建工具上下文
        const context: ToolContext = {
          toolName: name,
          arguments: args || {},
          traceId,
          startTime: Date.now(),
          logger: this.logger,
          storage: this.storageService,
          config: this.configManager
        };

        // 执行工具
        const startTime = Date.now();
        const result = await tool.handler(args, context);
        const duration = Date.now() - startTime;

        this.log('info', '工具调用成功', { 
          toolName: name, 
          traceId,
          duration
        });

        this.emit('tool:success', { toolName: name, duration, traceId });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };

      } catch (error) {
        this.log('error', '工具调用失败', { 
          toolName: name, 
          traceId,
          error: error instanceof Error ? error.message : String(error)
        });

        this.emit('tool:error', { toolName: name, error, traceId });

        // 转换错误格式
        if (error instanceof MCPError) {
          throw new McpError(
            ErrorCode.InternalError,
            error.message
          );
        } else if (error instanceof McpError) {
          throw error;
        } else {
          throw new McpError(
            ErrorCode.InternalError,
            `工具执行失败: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    });

    this.log('debug', 'MCP服务器处理器设置完成');
  }

  /**
   * 检查配置健康状态
   */
  private checkConfigHealth() {
    try {
      const isValid = this.configManager.isConfigValid();
      return {
        status: isValid ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        message: isValid ? '配置正常' : '配置无效',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: `配置检查失败: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 检查OSS健康状态
   */
  private async checkOSSHealth() {
    try {
      const startTime = Date.now();
      const isConnected = await this.storageService.checkConnection();
      const duration = Date.now() - startTime;

      return {
        status: isConnected ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        message: isConnected ? 'OSS连接正常' : 'OSS连接失败',
        timestamp: new Date().toISOString(),
        duration
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: `OSS检查失败: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 检查内存健康状态
   */
  private checkMemoryHealth() {
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      let status: HealthStatus;
      let message: string;

      if (usagePercent > 90) {
        status = HealthStatus.UNHEALTHY;
        message = `内存使用率过高: ${usagePercent.toFixed(1)}%`;
      } else if (usagePercent > 80) {
        status = HealthStatus.DEGRADED;
        message = `内存使用率较高: ${usagePercent.toFixed(1)}%`;
      } else {
        status = HealthStatus.HEALTHY;
        message = `内存使用正常: ${usagePercent.toFixed(1)}%`;
      }

      return {
        status,
        message,
        timestamp: new Date().toISOString(),
        details: {
          heapUsed: `${heapUsedMB}MB`,
          heapTotal: `${heapTotalMB}MB`,
          usagePercent: `${usagePercent.toFixed(1)}%`
        }
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: `内存检查失败: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 净化参数用于日志记录（移除敏感信息）
   */
  private sanitizeArguments(args: any): any {
    if (!args || typeof args !== 'object') {
      return args;
    }

    const sanitized = { ...args };
    
    // 隐藏文件内容
    if (sanitized.file && typeof sanitized.file === 'string' && sanitized.file.length > 100) {
      sanitized.file = `<文件内容，长度: ${sanitized.file.length}>`;
    }

    return redactSensitiveDetails(sanitized);
  }

  /**
   * 日志记录辅助方法
   */
  private log(level: string, message: string, data?: any): void {
    const safeData = data ? redactSensitiveDetails(data) : undefined;

    if (this.logger) {
      this.logger[level](`[MCP] ${message}`, safeData);
    } else {
      const timestamp = new Date().toISOString();
      const logData = safeData ? ` ${JSON.stringify(safeData)}` : '';
      console.error(`${timestamp} [${level.toUpperCase()}] [MCP] ${message}${logData}`);
    }
  }

  /**
   * 获取服务器统计信息
   */
  getStats() {
    const uptime = Date.now() - this.startTime.getTime();
    return {
      initialized: this.initialized,
      uptime: Math.floor(uptime / 1000),
      toolsCount: this.tools.size,
      startTime: this.startTime.toISOString(),
      version: this.configManager.getMCPConfig().version
    };
  }
}

/**
 * 创建MCP服务器实例
 */
export function createMCPServer(configManager: ConfigManager, logger?: any): MCPServer {
  return new MCPServer(configManager, logger);
}
