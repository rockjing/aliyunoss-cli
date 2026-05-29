/**
 * 阿里云OSS MCP服务 - OSS存储服务实现
 *
 * @fileoverview 基于阿里云OSS SDK的存储服务实现
 * @author aigroup-aliyunoss-mcp team
 * @version 1.0.0
 */

import OSS from 'ali-oss';
import {
  StorageService,
  StorageConfig,
  UploadOptions,
  FileListResult,
  FileMetadata,
  ACLResult,
  BatchDeleteResult,
  PartInfo,
  PartResult,
  CompleteMultipartResult,
  MultipartListResult,
  ListFilesOptions,
  StorageClass
} from '../types/storage.js';
import { MCPError, ErrorCode } from '../types/index.js';
import { assertObjectKey, assertObjectPrefix } from '../security/object-key.js';
import { redactSensitiveDetails } from '../security/redaction.js';

/**
 * 阿里云OSS存储服务实现
 */
export class OSSStorageService implements StorageService {
  private client: OSS;
  private config: StorageConfig;
  private downloadLinkExpiry: number;
  private logger?: any;

  constructor(config: StorageConfig, logger?: any) {
    this.config = { ...config };
    this.logger = logger;
    this.downloadLinkExpiry = 3600; // 默认1小时过期

    try {
      const ossOptions: any = {
        region: config.region,
        accessKeyId: config.accessKeyId,
        accessKeySecret: config.accessKeySecret,
        bucket: config.bucket,
        secure: config.secure ?? true,
        timeout: (config.timeout ?? 300) * 1000,
        internal: config.internal ?? false,
        stsToken: config.stsToken
      };

      if (config.cname) {
        ossOptions.cname = config.cname;
      }

      this.client = new OSS(ossOptions);

      this.log('info', 'OSS客户端初始化成功', {
        region: config.region,
        bucket: config.bucket,
        secure: config.secure,
        timeout: config.timeout
      });
    } catch (error) {
      this.log('error', 'OSS客户端初始化失败', { error });
      throw new MCPError(
        ErrorCode.OSS_CONNECTION_ERROR,
        `OSS客户端初始化失败: ${error instanceof Error ? error.message : String(error)}`,
        redactSensitiveDetails({ config, error })
      );
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(content: Buffer, filename: string, options?: UploadOptions): Promise<string> {
    const safeFilename = assertObjectKey(filename, '文件名');
    try {
      this.log('info', '开始上传文件', {
        filename: safeFilename,
        size: content.length,
        contentType: options?.contentType
      });

      const startTime = Date.now();

      const uploadOptions: any = {
        timeout: this.config.timeout ? this.config.timeout * 1000 : 300000,
        headers: {}
      };

      // 设置上传选项
      if (options?.contentType) {
        uploadOptions.headers['Content-Type'] = options.contentType;
      }
      if (options?.contentEncoding) {
        uploadOptions.headers['Content-Encoding'] = options.contentEncoding;
      }
      if (options?.contentDisposition) {
        uploadOptions.headers['Content-Disposition'] = options.contentDisposition;
      }
      if (options?.cacheControl) {
        uploadOptions.headers['Cache-Control'] = options.cacheControl;
      }
      if (options?.expires) {
        uploadOptions.headers['Expires'] = options.expires.toUTCString();
      }
      if (options?.storageClass) {
        uploadOptions.headers['x-oss-storage-class'] = options.storageClass;
      }

      // 设置自定义元数据
      if (options?.metadata) {
        for (const [key, value] of Object.entries(options.metadata)) {
          uploadOptions.headers[`x-oss-meta-${key}`] = value;
        }
      }

      // 设置标签
      if (options?.tagging) {
        const tags = Object.entries(options.tagging)
          .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
          .join('&');
        uploadOptions.headers['x-oss-tagging'] = tags;
      }

      const result = await this.client.put(safeFilename, content, uploadOptions);

      const duration = Date.now() - startTime;
      this.log('info', '文件上传成功', {
        filename: safeFilename,
        etag: (result as any).etag || '',
        duration
      });

      return result.name;
    } catch (error) {
      this.log('error', '文件上传失败', { filename: safeFilename, error });

      if (this.isTimeoutError(error)) {
        throw new MCPError(
          ErrorCode.OSS_TIMEOUT_ERROR,
          `文件上传超时: ${safeFilename}`,
          { filename: safeFilename, timeout: this.config.timeout, error }
        );
      }

      if (this.isAuthError(error)) {
        throw new MCPError(
          ErrorCode.OSS_AUTHENTICATION_ERROR,
          `OSS认证失败: ${safeFilename}`,
          { filename: safeFilename, error }
        );
      }

      throw new MCPError(
        ErrorCode.FILE_UPLOAD_FAILED,
        `文件上传失败: ${safeFilename}`,
        { filename: safeFilename, error }
      );
    }
  }

  /**
   * 生成临时下载链接
   */
  async generateTempUrl(filename: string, expires?: number): Promise<string> {
    const safeFilename = assertObjectKey(filename, '文件名');
    try {
      const expiresIn = expires ?? this.downloadLinkExpiry;
      this.log('info', '生成临时下载链接', { filename: safeFilename, expires: expiresIn });

      const startTime = Date.now();

      const url = await this.client.signatureUrl(safeFilename, {
        expires: expiresIn,
        method: 'GET'
      });

      const duration = Date.now() - startTime;
      this.log('info', '临时链接生成成功', { filename: safeFilename, duration });

      return url;
    } catch (error) {
      this.log('error', '生成临时下载链接失败', { filename: safeFilename, error });
      throw new MCPError(
        ErrorCode.OSS_CONNECTION_ERROR,
        `生成临时下载链接失败: ${safeFilename}`,
        { filename: safeFilename, error }
      );
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(filename: string): Promise<void> {
    const safeFilename = assertObjectKey(filename, '文件名');
    try {
      this.log('info', '删除文件', { filename: safeFilename });

      const startTime = Date.now();

      await this.client.delete(safeFilename, {
        timeout: this.config.timeout ? this.config.timeout * 1000 : 60000
      });

      const duration = Date.now() - startTime;
      this.log('info', '文件删除成功', { filename: safeFilename, duration });
    } catch (error) {
      this.log('error', '文件删除失败', { filename: safeFilename, error });

      if (this.isNotFoundError(error)) {
        // 文件不存在时不抛出错误，认为删除成功
        this.log('warn', '删除的文件不存在', { filename: safeFilename });
        return;
      }

      throw new MCPError(
        ErrorCode.FILE_DELETE_FAILED,
        `文件删除失败: ${safeFilename}`,
        { filename: safeFilename, error }
      );
    }
  }

  /**
   * 列出过期文件
   */
  async listExpiredFiles(): Promise<string[]> {
    try {
      this.log('info', '开始列出过期文件');

      const startTime = Date.now();
      const now = Date.now();
      const expiredFiles: string[] = [];
      const expiredTime = 2 * 60 * 60 * 1000; // 2小时

      const maxKeys = 1000;
      let marker: string | undefined;

      do {
        const result = await this.client.list({
          'max-keys': maxKeys,
          marker,
          prefix: ''
        }, {
          timeout: this.config.timeout ? this.config.timeout * 1000 : 60000
        });

        for (const object of result.objects || []) {
          const fileAge = now - new Date(object.lastModified).getTime();
          if (fileAge > expiredTime) {
            expiredFiles.push(object.name);
          }
        }

        marker = result.nextMarker;
      } while (marker);

      const duration = Date.now() - startTime;
      this.log('info', '列出过期文件完成', {
        count: expiredFiles.length,
        duration
      });

      return expiredFiles;
    } catch (error) {
      this.log('error', '列出过期文件失败', { error });
      return [];
    }
  }

  /**
   * 获取文件内容
   */
  async getFileContent(filename: string): Promise<Buffer> {
    const safeFilename = assertObjectKey(filename, '文件名');
    try {
      this.log('info', '获取文件内容', { filename: safeFilename });

      const startTime = Date.now();

      const result = await this.client.get(safeFilename, {
        timeout: this.config.timeout ? this.config.timeout * 1000 : 300000
      });

      if (!result.content) {
        throw new MCPError(
          ErrorCode.FILE_NOT_FOUND,
          `文件内容为空: ${safeFilename}`,
          { filename: safeFilename }
        );
      }

      const duration = Date.now() - startTime;
      this.log('info', '文件内容获取成功', {
        filename: safeFilename,
        size: result.content.length,
        duration
      });

      return result.content;
    } catch (error) {
      this.log('error', '获取文件内容失败', { filename: safeFilename, error });

      if (this.isTimeoutError(error)) {
        throw new MCPError(
          ErrorCode.OSS_TIMEOUT_ERROR,
          `获取文件内容超时: ${safeFilename}`,
          { filename: safeFilename, timeout: this.config.timeout, error }
        );
      }

      if (this.isNotFoundError(error)) {
        throw new MCPError(
          ErrorCode.FILE_NOT_FOUND,
          `文件不存在: ${safeFilename}`,
          { filename: safeFilename, error }
        );
      }

      throw new MCPError(
        ErrorCode.FILE_DOWNLOAD_FAILED,
        `获取文件内容失败: ${safeFilename}`,
        { filename: safeFilename, error }
      );
    }
  }

  /**
   * 列出文件
   */
  async listFiles(options?: ListFilesOptions): Promise<FileListResult> {
    const safePrefix = assertObjectPrefix(options?.prefix ?? '', '文件前缀');
    try {
      this.log('info', '列出文件', { options: { ...options, prefix: safePrefix } });

      const startTime = Date.now();

      const listOptions: any = {
        'max-keys': options?.maxKeys ?? 100,
        prefix: safePrefix,
        marker: options?.marker,
        delimiter: options?.delimiter,
        'encoding-type': options?.encodingType
      };

      const result = await this.client.list(listOptions, {
        timeout: this.config.timeout ? this.config.timeout * 1000 : 60000
      });

      const objects = (result.objects || []).map(obj => ({
        name: obj.name,
        size: obj.size,
        lastModified: new Date(obj.lastModified),
        etag: obj.etag,
        storageClass: obj.storageClass as StorageClass,
        owner: obj.owner ? {
          id: obj.owner.id,
          displayName: obj.owner.displayName
        } : {
          id: '',
          displayName: ''
        },
        url: `https://${this.config.bucket}.${this.config.region}.aliyuncs.com/${obj.name}`
      }));

      const duration = Date.now() - startTime;
      this.log('info', '文件列表获取成功', {
        count: objects.length,
        duration
      });

      return {
        objects,
        prefixes: result.prefixes,
        nextMarker: result.nextMarker,
        isTruncated: result.isTruncated,
        maxKeys: 100,
        prefix: safePrefix,
        delimiter: ''
      };
    } catch (error) {
      this.log('error', '列出文件失败', { options, error });
      throw new MCPError(
        ErrorCode.OSS_CONNECTION_ERROR,
        '列出文件失败',
        { options, error }
      );
    }
  }

  /**
   * 复制文件
   */
  async copyFile(source: string, target: string): Promise<void> {
    const safeSource = assertObjectKey(source, '源文件路径');
    const safeTarget = assertObjectKey(target, '目标文件路径');
    try {
      this.log('info', '复制文件', { source: safeSource, target: safeTarget });

      const startTime = Date.now();

      await this.client.copy(safeTarget, safeSource, {
        timeout: this.config.timeout ? this.config.timeout * 1000 : 60000
      });

      const duration = Date.now() - startTime;
      this.log('info', '文件复制成功', { source: safeSource, target: safeTarget, duration });
    } catch (error) {
      this.log('error', '文件复制失败', { source: safeSource, target: safeTarget, error });
      throw new MCPError(
        ErrorCode.OSS_CONNECTION_ERROR,
        `文件复制失败: ${safeSource} -> ${safeTarget}`,
        { source: safeSource, target: safeTarget, error }
      );
    }
  }

  /**
   * 获取文件元数据
   */
  async getFileMetadata(filename: string): Promise<FileMetadata> {
    const safeFilename = assertObjectKey(filename, '文件名');
    try {
      this.log('info', '获取文件元数据', { filename: safeFilename });

      const startTime = Date.now();

      const result = await this.client.head(safeFilename, {
        timeout: this.config.timeout ? this.config.timeout * 1000 : 60000
      });

      const duration = Date.now() - startTime;
      this.log('info', '文件元数据获取成功', { filename: safeFilename, duration });

      // 解析自定义元数据
      const metadata: Record<string, string> = {};
      for (const [key, value] of Object.entries(result.meta || {})) {
        if (key.startsWith('x-oss-meta-')) {
          metadata[key.replace('x-oss-meta-', '')] = value as string;
        }
      }

      return {
        name: safeFilename,
        size: (result as any).size || 0,
        lastModified: new Date((result as any).lastModified || Date.now()),
        contentType: (result.res?.headers as any)?.['content-type'] || 'application/octet-stream',
        etag: (result as any).etag || '',
        storageClass: ((result.res?.headers as any)?.['x-oss-storage-class'] as StorageClass) || 'Standard',
        contentEncoding: (result.res?.headers as any)?.['content-encoding'],
        contentLanguage: (result.res?.headers as any)?.['content-language'],
        cacheControl: (result.res?.headers as any)?.['cache-control'],
        contentDisposition: (result.res?.headers as any)?.['content-disposition'],
        expires: (result.res?.headers as any)?.['expires'] ? new Date((result.res?.headers as any)?.['expires']) : new Date(),
        metadata,
        versionId: (result as any).versionId
      };
    } catch (error) {
      this.log('error', '获取文件元数据失败', { filename: safeFilename, error });

      if (this.isNotFoundError(error)) {
        throw new MCPError(
          ErrorCode.FILE_NOT_FOUND,
          `文件不存在: ${safeFilename}`,
          { filename: safeFilename, error }
        );
      }

      throw new MCPError(
        ErrorCode.OSS_CONNECTION_ERROR,
        `获取文件元数据失败: ${safeFilename}`,
        { filename: safeFilename, error }
      );
    }
  }

  /**
   * 设置文件权限
   */
  async setFileACL(filename: string, acl: string): Promise<void> {
    const safeFilename = assertObjectKey(filename, '文件名');
    try {
      this.log('info', '设置文件权限', { filename: safeFilename, acl });

      const startTime = Date.now();

      await this.client.putACL(safeFilename, acl as any, {
        timeout: this.config.timeout ? this.config.timeout * 1000 : 60000
      });

      const duration = Date.now() - startTime;
      this.log('info', '文件权限设置成功', { filename: safeFilename, acl, duration });
    } catch (error) {
      this.log('error', '设置文件权限失败', { filename: safeFilename, acl, error });
      throw new MCPError(
        ErrorCode.OSS_PERMISSION_ERROR,
        `设置文件权限失败: ${safeFilename}`,
        { filename: safeFilename, acl, error }
      );
    }
  }

  /**
   * 获取文件权限
   */
  async getFileACL(filename: string): Promise<ACLResult> {
    const safeFilename = assertObjectKey(filename, '文件名');
    try {
      this.log('info', '获取文件权限', { filename: safeFilename });

      const startTime = Date.now();

      const result = await this.client.getACL(safeFilename, {
        timeout: this.config.timeout ? this.config.timeout * 1000 : 60000
      });

      const duration = Date.now() - startTime;
      this.log('info', '文件权限获取成功', { filename: safeFilename, duration });

      return {
        acl: result.acl,
        owner: {
          id: (result as any).owner?.id || '',
          displayName: (result as any).owner?.displayName || ''
        },
        grants: (result as any).grants || []
      };
    } catch (error) {
      this.log('error', '获取文件权限失败', { filename: safeFilename, error });
      throw new MCPError(
        ErrorCode.OSS_PERMISSION_ERROR,
        `获取文件权限失败: ${safeFilename}`,
        { filename: safeFilename, error }
      );
    }
  }

  /**
   * 批量删除文件
   */
  async deleteMultipleFiles(filenames: string[]): Promise<BatchDeleteResult> {
    const safeFilenames = filenames.map(filename => assertObjectKey(filename, '文件名'));
    try {
      this.log('info', '批量删除文件', { count: safeFilenames.length });

      const startTime = Date.now();

      const result = await this.client.deleteMulti(safeFilenames, {
        quiet: false,
        timeout: this.config.timeout ? this.config.timeout * 1000 : 120000
      });

      const duration = Date.now() - startTime;
      this.log('info', '批量删除文件完成', {
        total: safeFilenames.length,
        deleted: result.deleted?.length || 0,
        errors: (result as any).errors?.length || 0,
        duration
      });

      return {
        deleted: (result.deleted || []).map((item: any) => ({
          key: typeof item === 'string' ? item : item.key || '',
          versionId: typeof item === 'string' ? undefined : item.versionId
        })),
        errors: (result as any).errors || []
      };
    } catch (error) {
      this.log('error', '批量删除文件失败', { filenames: safeFilenames, error });
      throw new MCPError(
        ErrorCode.FILE_DELETE_FAILED,
        '批量删除文件失败',
        { filenames: safeFilenames, error }
      );
    }
  }

  /**
   * 初始化分片上传
   */
  async initMultipartUpload(filename: string, options?: UploadOptions): Promise<string> {
    const safeFilename = assertObjectKey(filename, '文件名');
    try {
      this.log('info', '初始化分片上传', { filename: safeFilename });

      const startTime = Date.now();

      const uploadOptions: any = {};

      if (options?.contentType) {
        uploadOptions.headers = uploadOptions.headers || {};
        uploadOptions.headers['Content-Type'] = options.contentType;
      }

      if (options?.storageClass) {
        uploadOptions.headers = uploadOptions.headers || {};
        uploadOptions.headers['x-oss-storage-class'] = options.storageClass;
      }

      const result = await this.client.initMultipartUpload(safeFilename, uploadOptions);

      const duration = Date.now() - startTime;
      this.log('info', '分片上传初始化成功', {
        filename: safeFilename,
        uploadId: result.uploadId,
        duration
      });

      return result.uploadId;
    } catch (error) {
      this.log('error', '初始化分片上传失败', { filename: safeFilename, error });
      throw new MCPError(
        ErrorCode.MULTIPART_INIT_FAILED,
        `初始化分片上传失败: ${safeFilename}`,
        { filename: safeFilename, error }
      );
    }
  }

  /**
   * 上传分片
   */
  async uploadPart(filename: string, uploadId: string, partNumber: number, content: Buffer): Promise<PartResult> {
    const safeFilename = assertObjectKey(filename, '文件名');
    try {
      this.log('info', '上传分片', {
        filename: safeFilename,
        uploadId,
        partNumber,
        size: content.length
      });

      const startTime = Date.now();

      const result = await this.client.uploadPart(safeFilename, uploadId, partNumber, content, 0, content.length, {
        timeout: this.config.timeout ? this.config.timeout * 1000 : 300000
      });

      const duration = Date.now() - startTime;
      this.log('info', '分片上传成功', {
        filename: safeFilename,
        uploadId,
        partNumber,
        etag: result.etag,
        duration
      });

      return {
        partNumber: partNumber,
        etag: result.etag,
        size: content.length
      };
    } catch (error) {
      this.log('error', '分片上传失败', { filename: safeFilename, uploadId, partNumber, error });
      throw new MCPError(
        ErrorCode.MULTIPART_UPLOAD_FAILED,
        `分片上传失败: ${safeFilename} 分片${partNumber}`,
        { filename: safeFilename, uploadId, partNumber, error }
      );
    }
  }

  /**
   * 完成分片上传
   */
  async completeMultipartUpload(filename: string, uploadId: string, parts: PartInfo[]): Promise<CompleteMultipartResult> {
    const safeFilename = assertObjectKey(filename, '文件名');
    try {
      this.log('info', '完成分片上传', {
        filename: safeFilename,
        uploadId,
        partsCount: parts.length
      });

      const startTime = Date.now();

      const result = await this.client.completeMultipartUpload(safeFilename, uploadId, parts, {
        timeout: this.config.timeout ? this.config.timeout * 1000 : 300000
      });

      const duration = Date.now() - startTime;
      this.log('info', '分片上传完成', {
        filename: safeFilename,
        uploadId,
        location: (result as any).location || '',
        etag: result.etag,
        duration
      });

      return {
        name: result.name,
        location: (result as any).location || '',
        bucket: result.bucket,
        key: (result as any).key || safeFilename,
        etag: result.etag,
        size: parts.reduce((total, part) => total + (part.size || 0), 0)
      };
    } catch (error) {
      this.log('error', '完成分片上传失败', { filename: safeFilename, uploadId, error });
      throw new MCPError(
        ErrorCode.MULTIPART_COMPLETE_FAILED,
        `完成分片上传失败: ${safeFilename}`,
        { filename: safeFilename, uploadId, error }
      );
    }
  }

  /**
   * 取消分片上传
   */
  async abortMultipartUpload(filename: string, uploadId: string): Promise<void> {
    const safeFilename = assertObjectKey(filename, '文件名');
    try {
      this.log('info', '取消分片上传', { filename: safeFilename, uploadId });

      const startTime = Date.now();

      await this.client.abortMultipartUpload(safeFilename, uploadId, {
        timeout: this.config.timeout ? this.config.timeout * 1000 : 60000
      });

      const duration = Date.now() - startTime;
      this.log('info', '分片上传已取消', { filename: safeFilename, uploadId, duration });
    } catch (error) {
      this.log('error', '取消分片上传失败', { filename: safeFilename, uploadId, error });
      throw new MCPError(
        ErrorCode.OSS_CONNECTION_ERROR,
        `取消分片上传失败: ${safeFilename}`,
        { filename: safeFilename, uploadId, error }
      );
    }
  }

  /**
   * 列出进行中的分片上传
   */
  async listMultipartUploads(options?: { prefix?: string; maxUploads?: number; keyMarker?: string; uploadIdMarker?: string; }): Promise<MultipartListResult> {
    const safePrefix = assertObjectPrefix(options?.prefix ?? '', '文件前缀');
    try {
      this.log('info', '列出进行中的分片上传', { options: { ...options, prefix: safePrefix } });

      const startTime = Date.now();

      const listOptions: any = {
        'max-uploads': options?.maxUploads ?? 100,
        prefix: safePrefix,
        'key-marker': options?.keyMarker,
        'upload-id-marker': options?.uploadIdMarker
      };

      const result = await this.client.listUploads(listOptions, {
        timeout: this.config.timeout ? this.config.timeout * 1000 : 60000
      });

      const uploads = (result.uploads || []).map((upload: any) => ({
        key: upload.key || '',
        uploadId: upload.uploadId,
        storageClass: (upload.storageClass as StorageClass) || 'Standard',
        initiated: new Date(upload.initiated || Date.now()),
        owner: {
          id: upload.owner?.id || '',
          displayName: upload.owner?.displayName || ''
        }
      }));

      const duration = Date.now() - startTime;
      this.log('info', '分片上传列表获取成功', {
        count: uploads.length,
        duration
      });

      return {
        uploads,
        prefixes: (result as any).prefixes || [],
        isTruncated: result.isTruncated,
        nextKeyMarker: result.nextKeyMarker,
        nextUploadIdMarker: result.nextUploadIdMarker,
        maxUploads: (result as any).maxUploads || 100,
        prefix: (result as any).prefix || ''
      };
    } catch (error) {
      this.log('error', '列出分片上传失败', { options, error });
      throw new MCPError(
        ErrorCode.OSS_CONNECTION_ERROR,
        '列出分片上传失败',
        { options, error }
      );
    }
  }

  /**
   * 检查连接状态
   */
  async checkConnection(): Promise<boolean> {
    try {
      // 通过列出存储桶来测试连接
      await this.client.list({ 'max-keys': 1 }, { timeout: 10000 });
      return true;
    } catch (error) {
      this.log('error', 'OSS连接检查失败', { error });
      return false;
    }
  }

  /**
   * 获取配置信息
   */
  getConfig(): StorageConfig {
    return redactSensitiveDetails(this.config);
  }

  /**
   * 日志记录辅助方法
   */
  private log(level: string, message: string, data?: any): void {
    const safeData = data ? redactSensitiveDetails(data) : undefined;

    if (this.logger) {
      this.logger[level](`[OSS] ${message}`, safeData);
    } else {
      const timestamp = new Date().toISOString();
      const logData = safeData ? ` ${JSON.stringify(safeData)}` : '';
      console.error(`${timestamp} [${level.toUpperCase()}] [OSS] ${message}${logData}`);
    }
  }

  /**
   * 错误类型判断辅助方法
   */
  private isTimeoutError(error: any): boolean {
    return error.name === 'ConnectionTimeoutError' ||
           error.code === 'ConnectionTimeout' ||
           error.message?.includes('timeout');
  }

  private isAuthError(error: any): boolean {
    return error.code === 'AccessDenied' ||
           error.code === 'InvalidAccessKeyId' ||
           error.code === 'SignatureDoesNotMatch' ||
           error.status === 403;
  }

  private isNotFoundError(error: any): boolean {
    return error.code === 'NoSuchKey' ||
           error.status === 404;
  }
}

/**
 * 创建OSS存储服务实例
 */
export function createOSSStorage(config: StorageConfig, logger?: any): OSSStorageService {
  return new OSSStorageService(config, logger);
}
