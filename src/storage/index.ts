/**
 * 阿里云OSS MCP服务 - 存储模块导出
 * 
 * @fileoverview 存储服务相关功能的统一导出
 * @author aigroup-aliyunoss-mcp team
 * @version 1.0.0
 */

// 导出OSS存储服务
export { OSSStorageService, createOSSStorage } from './oss-storage.js';

// 导出存储相关类型
export type {
  StorageService,
  StorageConfig,
  StorageBackend,
  UploadOptions,
  FileListResult,
  FileMetadata,
  ACLResult,
  BatchDeleteResult,
  PartInfo,
  PartResult,
  CompleteMultipartResult,
  MultipartListResult,
  UploadResult,
  ListFilesOptions,
  StorageClass,
  FileInfo,
  StorageStats,
  StorageQuota,
  StorageEventType,
  StorageEventData
} from '../types/storage.js';