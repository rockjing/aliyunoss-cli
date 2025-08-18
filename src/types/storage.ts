/**
 * 阿里云OSS MCP服务 - 存储相关类型定义
 * 
 * @fileoverview 定义存储服务相关的接口和类型
 * @author aigroup-aliyunoss-mcp team
 * @version 1.0.0
 */

/**
 * 存储配置接口
 */
export interface StorageConfig {
  /** 阿里云访问密钥ID */
  accessKeyId: string;
  /** 阿里云访问密钥Secret */
  accessKeySecret: string;
  /** OSS存储桶名称 */
  bucket: string;
  /** OSS地域 */
  region: string;
  /** 是否使用HTTPS */
  secure?: boolean;
  /** 请求超时时间（秒） */
  timeout?: number;
  /** OSS内网访问 */
  internal?: boolean;
  /** 自定义域名 */
  cname?: string;
  /** 是否使用加速域名 */
  isRequestPay?: boolean;
  /** STS临时凭证 */
  stsToken?: string;
}

/**
 * 存储服务抽象接口
 */
export interface StorageService {
  /**
   * 上传文件
   * @param content 文件内容
   * @param filename 文件名
   * @param options 上传选项
   */
  uploadFile(content: Buffer, filename: string, options?: UploadOptions): Promise<string>;

  /**
   * 生成临时下载链接
   * @param filename 文件名
   * @param expires 过期时间（秒）
   */
  generateTempUrl(filename: string, expires?: number): Promise<string>;

  /**
   * 删除文件
   * @param filename 文件名
   */
  deleteFile(filename: string): Promise<void>;

  /**
   * 列出过期文件
   */
  listExpiredFiles(): Promise<string[]>;

  /**
   * 获取文件内容
   * @param filename 文件名
   */
  getFileContent(filename: string): Promise<Buffer>;

  /**
   * 列出文件
   * @param options 列表选项
   */
  listFiles?(options?: ListFilesOptions): Promise<FileListResult>;

  /**
   * 复制文件
   * @param source 源文件路径
   * @param target 目标文件路径
   */
  copyFile?(source: string, target: string): Promise<void>;

  /**
   * 获取文件元数据
   * @param filename 文件名
   */
  getFileMetadata?(filename: string): Promise<FileMetadata>;

  /**
   * 设置文件权限
   * @param filename 文件名
   * @param acl 权限设置
   */
  setFileACL?(filename: string, acl: string): Promise<void>;

  /**
   * 获取文件权限
   * @param filename 文件名
   */
  getFileACL?(filename: string): Promise<ACLResult>;

  /**
   * 批量删除文件
   * @param filenames 文件名列表
   */
  deleteMultipleFiles?(filenames: string[]): Promise<BatchDeleteResult>;

  /**
   * 初始化分片上传
   * @param filename 文件名
   * @param options 上传选项
   */
  initMultipartUpload?(filename: string, options?: UploadOptions): Promise<string>;

  /**
   * 上传分片
   * @param filename 文件名
   * @param uploadId 上传ID
   * @param partNumber 分片号
   * @param content 分片内容
   */
  uploadPart?(filename: string, uploadId: string, partNumber: number, content: Buffer): Promise<PartResult>;

  /**
   * 完成分片上传
   * @param filename 文件名
   * @param uploadId 上传ID
   * @param parts 分片信息列表
   */
  completeMultipartUpload?(filename: string, uploadId: string, parts: PartInfo[]): Promise<CompleteMultipartResult>;

  /**
   * 取消分片上传
   * @param filename 文件名
   * @param uploadId 上传ID
   */
  abortMultipartUpload?(filename: string, uploadId: string): Promise<void>;

  /**
   * 列出进行中的分片上传
   * @param options 列表选项
   */
  listMultipartUploads?(options?: ListMultipartOptions): Promise<MultipartListResult>;
}

/**
 * 上传选项
 */
export interface UploadOptions {
  /** 内容类型 */
  contentType?: string;
  /** 内容编码 */
  contentEncoding?: string;
  /** 内容处置 */
  contentDisposition?: string;
  /** 缓存控制 */
  cacheControl?: string;
  /** 过期时间 */
  expires?: Date;
  /** 自定义元数据 */
  metadata?: Record<string, string>;
  /** 存储类型 */
  storageClass?: StorageClass;
  /** 服务端加密 */
  serverSideEncryption?: string;
  /** 标签 */
  tagging?: Record<string, string>;
}

/**
 * 存储类型枚举
 */
export enum StorageClass {
  STANDARD = 'Standard',
  INFREQUENT_ACCESS = 'IA',
  ARCHIVE = 'Archive',
  COLD_ARCHIVE = 'ColdArchive'
}

/**
 * 文件列表选项
 */
export interface ListFilesOptions {
  /** 前缀过滤 */
  prefix?: string;
  /** 最大返回数量 */
  maxKeys?: number;
  /** 分页标记 */
  marker?: string;
  /** 分隔符 */
  delimiter?: string;
  /** 编码类型 */
  encodingType?: string;
}

/**
 * 文件信息
 */
export interface FileInfo {
  /** 文件名 */
  name: string;
  /** 文件大小（字节） */
  size: number;
  /** 最后修改时间 */
  lastModified: Date;
  /** ETag */
  etag: string;
  /** 存储类型 */
  storageClass: StorageClass;
  /** 所有者信息 */
  owner?: {
    id: string;
    displayName: string;
  };
  /** 文件URL */
  url?: string;
}

/**
 * 文件列表结果
 */
export interface FileListResult {
  /** 文件列表 */
  objects: FileInfo[];
  /** 公共前缀 */
  prefixes?: string[];
  /** 下一页标记 */
  nextMarker?: string;
  /** 是否截断 */
  isTruncated: boolean;
  /** 最大键数 */
  maxKeys: number;
  /** 前缀 */
  prefix?: string;
  /** 分隔符 */
  delimiter?: string;
}

/**
 * 文件元数据
 */
export interface FileMetadata {
  /** 文件名 */
  name: string;
  /** 文件大小 */
  size: number;
  /** 最后修改时间 */
  lastModified: Date;
  /** 内容类型 */
  contentType: string;
  /** ETag */
  etag: string;
  /** 存储类型 */
  storageClass?: StorageClass;
  /** 内容编码 */
  contentEncoding?: string;
  /** 内容语言 */
  contentLanguage?: string;
  /** 缓存控制 */
  cacheControl?: string;
  /** 内容处置 */
  contentDisposition?: string;
  /** 过期时间 */
  expires?: Date;
  /** 自定义元数据 */
  metadata?: Record<string, string>;
  /** 版本ID */
  versionId?: string;
  /** 标签 */
  tagging?: Record<string, string>;
}

/**
 * ACL结果
 */
export interface ACLResult {
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
 * 批量删除结果
 */
export interface BatchDeleteResult {
  /** 删除成功的文件 */
  deleted: Array<{
    key: string;
    versionId?: string;
  }>;
  /** 删除失败的文件 */
  errors?: Array<{
    key: string;
    code: string;
    message: string;
    versionId?: string;
  }>;
}

/**
 * 分片信息
 */
export interface PartInfo {
  /** 分片号 */
  number: number;
  /** ETag */
  etag: string;
  /** 分片大小 */
  size?: number;
}

/**
 * 分片结果
 */
export interface PartResult {
  /** 分片号 */
  partNumber: number;
  /** ETag */
  etag: string;
  /** 分片大小 */
  size: number;
}

/**
 * 完成分片上传结果
 */
export interface CompleteMultipartResult {
  /** 文件名 */
  name: string;
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
}

/**
 * 分片上传列表选项
 */
export interface ListMultipartOptions {
  /** 前缀过滤 */
  prefix?: string;
  /** 最大返回数量 */
  maxUploads?: number;
  /** 键标记 */
  keyMarker?: string;
  /** 上传ID标记 */
  uploadIdMarker?: string;
  /** 分隔符 */
  delimiter?: string;
  /** 编码类型 */
  encodingType?: string;
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
  storageClass: StorageClass;
  /** 初始化时间 */
  initiated: Date;
  /** 所有者信息 */
  owner: {
    id: string;
    displayName: string;
  };
}

/**
 * 分片上传列表结果
 */
export interface MultipartListResult {
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
  /** 最大上传数 */
  maxUploads: number;
  /** 前缀 */
  prefix?: string;
  /** 分隔符 */
  delimiter?: string;
}

/**
 * 存储后端抽象接口
 */
export interface StorageBackend {
  /** 后端名称 */
  name: string;
  
  /** 后端类型 */
  type: 'oss' | 's3' | 'gcs' | 'azure' | 'local';
  
  /** 上传文件 */
  uploadFile(content: Buffer, fileName: string, options?: UploadOptions): Promise<UploadResult>;
  
  /** 下载文件 */
  downloadFile(fileName: string): Promise<Buffer>;
  
  /** 删除文件 */
  deleteFile(fileName: string): Promise<void>;
  
  /** 列出文件 */
  listFiles(options?: ListFilesOptions): Promise<FileInfo[]>;
  
  /** 生成临时URL */
  generateTempUrl(fileName: string, expires: number): Promise<string>;
  
  /** 检查连接 */
  checkConnection(): Promise<boolean>;
  
  /** 获取配置 */
  getConfig(): StorageConfig;
}

/**
 * 上传结果
 */
export interface UploadResult {
  /** 文件名 */
  name: string;
  /** 文件URL */
  url: string;
  /** 文件大小 */
  size: number;
  /** ETag */
  etag: string;
  /** 文件位置 */
  location?: string;
  /** 版本ID */
  versionId?: string;
}

/**
 * 存储统计信息
 */
export interface StorageStats {
  /** 总文件数 */
  totalFiles: number;
  /** 总存储大小（字节） */
  totalSize: number;
  /** 存储使用率 */
  usage: number;
  /** 最后更新时间 */
  lastUpdated: Date;
  /** 按存储类型分组的统计 */
  byStorageClass: Record<StorageClass, {
    count: number;
    size: number;
  }>;
}

/**
 * 存储配额信息
 */
export interface StorageQuota {
  /** 最大存储大小（字节） */
  maxSize: number;
  /** 最大文件数 */
  maxFiles: number;
  /** 已使用存储大小 */
  usedSize: number;
  /** 已使用文件数 */
  usedFiles: number;
  /** 是否启用配额检查 */
  enabled: boolean;
}

/**
 * 存储事件类型枚举
 */
export enum StorageEventType {
  FILE_UPLOADED = 'file:uploaded',
  FILE_DOWNLOADED = 'file:downloaded',
  FILE_DELETED = 'file:deleted',
  FILE_COPIED = 'file:copied',
  MULTIPART_STARTED = 'multipart:started',
  MULTIPART_COMPLETED = 'multipart:completed',
  MULTIPART_ABORTED = 'multipart:aborted'
}

/**
 * 存储事件数据
 */
export interface StorageEventData {
  /** 事件类型 */
  type: StorageEventType;
  /** 文件名 */
  fileName: string;
  /** 文件大小 */
  fileSize?: number;
  /** 操作时间 */
  timestamp: Date;
  /** 操作用户 */
  userId?: string;
  /** 额外数据 */
  metadata?: Record<string, any>;
}