/**
 * 阿里云OSS MCP服务 - 工具模块导出
 * 
 * @fileoverview MCP工具的统一导出
 * @author alioss-mcp team
 * @version 1.0.0
 */

import { ToolDefinition } from '../types/index.js';

// 导入所有工具
import { uploadFileTool } from './upload-file.js';
import { generateTempUrlTool } from './generate-temp-url.js';
import { deleteFileTool, deleteMultipleFilesTool } from './delete-file.js';
import { listFilesTool } from './list-files.js';
import { copyObjectTool } from './copy-object.js';
import { getObjectMetaTool } from './get-object-meta.js';

/**
 * 所有可用的MCP工具
 */
export const allTools: ToolDefinition[] = [
  uploadFileTool,
  generateTempUrlTool,
  deleteFileTool,
  deleteMultipleFilesTool,
  listFilesTool,
  copyObjectTool,
  getObjectMetaTool
];

/**
 * 工具映射表，用于快速查找
 */
export const toolsMap: Map<string, ToolDefinition> = new Map(
  allTools.map(tool => [tool.name, tool])
);

/**
 * 获取工具定义
 */
export function getToolDefinition(toolName: string): ToolDefinition | undefined {
  return toolsMap.get(toolName);
}

/**
 * 获取所有工具名称
 */
export function getAllToolNames(): string[] {
  return allTools.map(tool => tool.name);
}

/**
 * 检查工具是否存在
 */
export function hasToolDefinition(toolName: string): boolean {
  return toolsMap.has(toolName);
}

/**
 * 获取工具数量
 */
export function getToolCount(): number {
  return allTools.length;
}

/**
 * 根据分类获取工具
 */
export function getToolsByCategory(): Record<string, ToolDefinition[]> {
  const categories: Record<string, ToolDefinition[]> = {
    file: [],
    management: [],
    utility: []
  };

  for (const tool of allTools) {
    switch (tool.name) {
      case 'uploadFile':
      case 'deleteObject':
      case 'deleteMultipleObjects':
      case 'copyObject':
        categories.file = categories.file || [];
        categories.file.push(tool);
        break;
      case 'listObjects':
      case 'getObjectUrl':
      case 'getObjectMeta':
        categories.management = categories.management || [];
        categories.management.push(tool);
        break;
      default:
        categories.utility = categories.utility || [];
        categories.utility.push(tool);
        break;
    }
  }

  return categories;
}

/**
 * 获取工具摘要信息
 */
export function getToolsSummary(): Array<{
  name: string;
  description: string;
  required: string[];
  optional: string[];
}> {
  return allTools.map(tool => ({
    name: tool.name,
    description: tool.description || '',
    required: tool.inputSchema.required || [],
    optional: Object.keys(tool.inputSchema.properties || {}).filter(
      key => !(tool.inputSchema.required || []).includes(key)
    )
  }));
}

// 导出单个工具
export { uploadFileTool } from './upload-file.js';
export { generateTempUrlTool } from './generate-temp-url.js';
export { deleteFileTool, deleteMultipleFilesTool } from './delete-file.js';
export { listFilesTool } from './list-files.js';
export { copyObjectTool } from './copy-object.js';
export { getObjectMetaTool } from './get-object-meta.js';

// 导出工具相关类型
export type {
  UploadFileArgs,
  UploadFileResult,
  GetObjectUrlArgs,
  GetObjectUrlResult,
  DeleteObjectArgs,
  DeleteObjectResult,
  DeleteMultipleObjectsArgs,
  DeleteMultipleObjectsResult,
  ListObjectsArgs,
  ListObjectsResult,
  CopyObjectArgs,
  CopyObjectResult,
  GetObjectMetaArgs,
  GetObjectMetaResult,
  ObjectInfo
} from '../types/tools.js';