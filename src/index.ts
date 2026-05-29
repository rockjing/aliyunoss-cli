#!/usr/bin/env node

/**
 * 阿里云OSS MCP服务 - 主入口文件
 *
 * @fileoverview 应用程序的启动入口点
 * @author aigroup-aliyunoss-mcp team
 * @version 1.1.0
 */

// 加载环境变量
import 'dotenv/config';

import { createConfigManager } from './config/index.js';
import { redactSensitiveDetails } from './security/redaction.js';
import { createMCPServer } from './server/index.js';
import { MCPError, ErrorCode, LogLevel } from './types/index.js';

/**
 * 简单日志记录器
 */
class SimpleLogger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    return levels.indexOf(level) <= levels.indexOf(this.level);
  }

  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const safeData = data ? redactSensitiveDetails(data) : undefined;
    const logData = safeData ? ` ${JSON.stringify(safeData, null, 2)}` : '';
    
    // 输出到stderr避免与MCP消息混淆
    console.error(`${timestamp} [${level.toUpperCase()}] ${message}${logData}`);
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }
}

/**
 * 应用程序类
 */
class Application {
  private configManager?: any;
  private mcpServer?: any;
  private logger: SimpleLogger;

  constructor() {
    this.logger = new SimpleLogger(this.getLogLevel());
  }

  /**
   * 从环境变量获取日志级别
   */
  private getLogLevel(): LogLevel {
    const envLevel = process.env.MCP_LOG_LEVEL?.toLowerCase();
    switch (envLevel) {
      case 'debug': return LogLevel.DEBUG;
      case 'info': return LogLevel.INFO;
      case 'warn': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }

  /**
   * 解析命令行参数
   */
  private parseArgs(): { stdio: boolean; health: boolean; validate: boolean; help: boolean } {
    const args = process.argv.slice(2);
    
    return {
      stdio: args.includes('--stdio'),
      health: args.includes('--health'),
      validate: args.includes('--validate-config'),
      help: args.includes('--help') || args.includes('-h')
    };
  }

  /**
   * 显示帮助信息
   */
  private showHelp(): void {
    console.log(`
阿里云OSS MCP服务器 v1.1.0

用法: aigroup-aliyunoss-mcp [选项]

选项:
  --stdio             启动stdio模式的MCP服务器（默认）
  --health            显示健康检查信息
  --validate-config   验证配置文件
  --help, -h          显示此帮助信息

环境变量:
  OSS_ACCESS_KEY_ID      阿里云访问密钥ID（必需）
  OSS_ACCESS_KEY_SECRET  阿里云访问密钥Secret（必需）
  OSS_BUCKET            OSS存储桶名称（必需）
  OSS_REGION            OSS地域（必需）
  OSS_SECURE            是否使用HTTPS（可选，默认true）
  OSS_TIMEOUT           请求超时时间（可选，默认300秒）
  MCP_LOG_LEVEL         日志级别（可选，默认info）

示例:
  aigroup-aliyunoss-mcp --stdio
  aigroup-aliyunoss-mcp --health
  aigroup-aliyunoss-mcp --validate-config

更多信息请访问: https://github.com/your-org/aigroup-aliyunoss-mcp
`);
  }

  /**
   * 验证配置
   */
  private async validateConfig(): Promise<void> {
    try {
      console.log('验证配置...');
      
      this.configManager = createConfigManager();
      await this.configManager.loadConfig();
      
      const summary = this.configManager.getConfigSummary();
      
      console.log('✅ 配置验证成功');
      console.log('\n配置摘要:');
      console.log(JSON.stringify(summary, null, 2));
      
    } catch (error) {
      console.error('❌ 配置验证失败:');
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * 显示健康状态
   */
  private async showHealth(): Promise<void> {
    try {
      console.log('检查服务健康状态...');
      
      // 初始化组件
      this.configManager = createConfigManager();
      await this.configManager.loadConfig();
      
      this.mcpServer = createMCPServer(this.configManager, this.logger);
      await this.mcpServer.initialize();
      
      const health = await this.mcpServer.getHealthStatus();
      
      console.log('\n健康检查结果:');
      console.log(JSON.stringify(health, null, 2));
      
      // 根据健康状态设置退出码
      const exitCode = health.status === 'healthy' ? 0 : 1;
      process.exit(exitCode);
      
    } catch (error) {
      console.error('❌ 健康检查失败:');
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * 启动MCP服务器
   */
  private async startServer(): Promise<void> {
    try {
      this.logger.info('阿里云OSS MCP服务器启动中...');
      
      // 初始化配置管理器
      this.configManager = createConfigManager();
      await this.configManager.loadConfig();
      
      this.logger.info('配置加载完成', {
        environment: this.configManager.getPublicConfig().environment.type
      });
      
      // 创建并启动MCP服务器
      this.mcpServer = createMCPServer(this.configManager, this.logger);
      await this.mcpServer.start();
      
      this.logger.info('阿里云OSS MCP服务器启动成功');
      
      // 监听服务器事件
      this.mcpServer.on('tool:success', (event: any) => {
        this.logger.debug('工具调用成功', event);
      });
      
      this.mcpServer.on('tool:error', (event: any) => {
        this.logger.error('工具调用失败', event);
      });
      
    } catch (error) {
      this.logger.error('MCP服务器启动失败', { error });
      
      if (error instanceof MCPError) {
        console.error(`错误: ${error.message}`);
        if (error.code === ErrorCode.CONFIG_INVALID) {
          console.error('请检查配置文件或环境变量设置');
        } else if (error.code === ErrorCode.OSS_CONNECTION_ERROR) {
          console.error('请检查OSS连接配置和网络连接');
        }
      } else {
        console.error(`启动失败: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      process.exit(1);
    }
  }

  /**
   * 优雅关闭
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    this.logger.info(`收到${signal}信号，开始优雅关闭...`);
    
    try {
      if (this.mcpServer) {
        await this.mcpServer.stop();
      }
      
      this.logger.info('服务器已停止');
      process.exit(0);
    } catch (error) {
      this.logger.error('关闭过程中出错', { error });
      process.exit(1);
    }
  }

  /**
   * 设置信号处理器
   */
  private setupSignalHandlers(): void {
    // 处理优雅关闭信号
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    
    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      this.logger.error('未捕获的异常', { error });
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('未处理的Promise拒绝', { reason, promise });
      process.exit(1);
    });
  }

  /**
   * 运行应用程序
   */
  async run(): Promise<void> {
    const args = this.parseArgs();
    
    // 设置信号处理器
    this.setupSignalHandlers();
    
    try {
      if (args.help) {
        this.showHelp();
        return;
      }
      
      if (args.validate) {
        await this.validateConfig();
        return;
      }
      
      if (args.health) {
        await this.showHealth();
        return;
      }
      
      // 默认启动stdio模式的MCP服务器
      await this.startServer();
      
    } catch (error) {
      this.logger.error('应用程序运行失败', { error });
      process.exit(1);
    }
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const app = new Application();
  await app.run();
}

// 执行main函数
main().catch((error) => {
  console.error('应用程序启动失败:', error);
  process.exit(1);
});

// 导出主要类和函数用于测试
export { Application, main };
