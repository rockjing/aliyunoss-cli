import OSS from 'ali-oss';
import { StorageConfig, StorageService } from '../types/index.js';
import { assertObjectKey } from './src/security/object-key.js';

export class OssStorageService implements StorageService {
  private client: OSS;
  private downloadLinkExpiry: number;
  private timeout: number;

  constructor(config: StorageConfig) {
    // 从环境变量获取超时配置，默认300秒（5分钟）
    const envTimeout = process.env.OSS_TIMEOUT ? parseInt(process.env.OSS_TIMEOUT) : 300;
    this.timeout = (config.timeout || envTimeout) * 1000; // 转换为毫秒
    
    console.log(`[OSS] 初始化OSS客户端，超时配置: ${this.timeout}ms (${this.timeout/1000}秒)`);
    console.log(`[OSS] 环境变量OSS_TIMEOUT: ${process.env.OSS_TIMEOUT || '未设置'}`);
    console.log(`[OSS] 配置超时: ${config.timeout || '未设置'}秒`);
    console.log(`[OSS] 最终使用超时: ${this.timeout/1000}秒`);

    this.client = new OSS({
      region: config.region,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      bucket: config.bucket,
      secure: config.secure,
      timeout: this.timeout, // 设置全局超时
    });
    
    // 默认1小时过期
    this.downloadLinkExpiry = 3600;
  }

  async uploadFile(content: Buffer, filename: string): Promise<string> {
    try {
      const safeFilename = assertObjectKey(filename, '文件名');
      console.log(`[OSS] 开始上传文件: ${safeFilename}, 大小: ${content.length} bytes, 超时: ${this.timeout}ms`);
      const startTime = Date.now();
      
      const result = await this.client.put(safeFilename, content, {
        timeout: this.timeout, // 为单个操作设置超时
      });
      
      const duration = Date.now() - startTime;
      console.log(`[OSS] 文件上传成功: ${safeFilename}, 耗时: ${duration}ms`);
      
      return result.name;
    } catch (error) {
      console.error(`[OSS] 文件上传失败: ${filename}`, error);
      if (error instanceof Error && (error.name === 'ConnectionTimeoutError' || (error as any).code === 'ConnectionTimeout')) {
        throw new Error(`文件上传超时（${this.timeout/1000}秒），请稍后重试`);
      }
      throw new Error('文件上传失败');
    }
  }

  async generateTempUrl(filename: string): Promise<string> {
    try {
      const safeFilename = assertObjectKey(filename, '文件名');
      console.log(`[OSS] 生成临时下载链接: ${safeFilename}, 过期时间: ${this.downloadLinkExpiry}秒`);
      const startTime = Date.now();
      
      const url = await this.client.signatureUrl(safeFilename, {
        expires: this.downloadLinkExpiry, // signatureUrl的expires参数是秒数，不是毫秒
      });
      
      const duration = Date.now() - startTime;
      console.log(`[OSS] 临时链接生成成功: ${safeFilename}, 耗时: ${duration}ms`);
      
      return url;
    } catch (error) {
      console.error(`[OSS] 生成临时下载链接失败: ${filename}`, error);
      throw new Error('生成临时下载链接失败');
    }
  }

  async deleteFile(filename: string): Promise<void> {
    try {
      const safeFilename = assertObjectKey(filename, '文件名');
      console.log(`[OSS] 删除文件: ${safeFilename}`);
      const startTime = Date.now();
      
      await this.client.delete(safeFilename, {
        timeout: this.timeout,
      });
      
      const duration = Date.now() - startTime;
      console.log(`[OSS] 文件删除成功: ${safeFilename}, 耗时: ${duration}ms`);
    } catch (error) {
      console.error(`[OSS] 文件删除失败: ${filename}`, error);
      throw new Error('文件删除失败');
    }
  }

  async listExpiredFiles(): Promise<string[]> {
    try {
      console.log(`[OSS] 开始列出过期文件, 超时: ${this.timeout}ms`);
      const startTime = Date.now();
      const now = Date.now();
      const expiredFiles: string[] = [];
      
      const maxKeys = 1000;
      let marker: string | null = null;
      
      do {
        const result = await this.client.list({
          'max-keys': maxKeys,
          marker: marker || undefined,
          prefix: '',
        }, {
          timeout: this.timeout // 使用配置的超时时间
        });
        
        for (const object of result.objects || []) {
          const fileAge = now - new Date(object.lastModified).getTime();
          // 如果文件超过2小时
          if (fileAge > 7200000) {
            expiredFiles.push(object.name);
          }
        }
        
        marker = result.nextMarker;
      } while (marker);
      
      const duration = Date.now() - startTime;
      console.log(`[OSS] 列出过期文件完成, 找到 ${expiredFiles.length} 个过期文件, 耗时: ${duration}ms`);
      
      return expiredFiles;
    } catch (error) {
      console.error('[OSS] 列出过期文件失败:', error);
      return [];
    }
  }

  async getFileContent(filename: string): Promise<Buffer> {
    try {
      const safeFilename = assertObjectKey(filename, '文件名');
      console.log(`[OSS] 获取文件内容: ${safeFilename}, 超时: ${this.timeout}ms`);
      const startTime = Date.now();
      
      const result = await this.client.get(safeFilename, {
        timeout: this.timeout,
      });
      
      if (!result.content) {
        throw new Error('No content received');
      }
      
      const duration = Date.now() - startTime;
      console.log(`[OSS] 文件内容获取成功: ${safeFilename}, 大小: ${result.content.length} bytes, 耗时: ${duration}ms`);
      
      return result.content;
    } catch (error) {
      console.error(`[OSS] 获取文件内容失败: ${filename}`, error);
      if (error instanceof Error && (error.name === 'ConnectionTimeoutError' || (error as any).code === 'ConnectionTimeout')) {
        throw new Error(`获取文件内容超时（${this.timeout/1000}秒），请稍后重试`);
      }
      throw new Error('获取文件内容失败');
    }
  }
}
