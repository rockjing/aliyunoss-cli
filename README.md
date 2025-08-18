# 阿里云OSS MCP服务器

[![npm version](https://badge.fury.io/js/aigroup-aliyunoss-mcp.svg)](https://badge.fury.io/js/aigroup-aliyunoss-mcp)
[![Node.js CI](https://github.com/your-org/aigroup-aliyunoss-mcp/workflows/Node.js%20CI/badge.svg)](https://github.com/your-org/aigroup-aliyunoss-mcp/actions)
[![codecov](https://codecov.io/gh/your-org/aigroup-aliyunoss-mcp/branch/main/graph/badge.svg)](https://codecov.io/gh/your-org/aigroup-aliyunoss-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 🚀 为阿里云OSS (Object Storage Service) 提供的MCP (Model Context Protocol) 服务器，支持完整的云存储操作功能。

## ✨ 特性

- 🔌 **完整的OSS功能**: 支持文件上传、下载、删除、列表等全部操作
- 📡 **MCP协议支持**: 基于stdio协议，与AI助手无缝集成
- ⚡ **高性能**: 支持分片上传、并发操作和智能缓存
- 🔧 **易于配置**: 环境变量配置，支持配置热重载
- 🛡️ **安全可靠**: 完善的错误处理、访问控制和审计日志
- 🔍 **可观测性**: 健康检查、性能监控和结构化日志
- 🧩 **可扩展**: 插件系统和中间件架构
- 📦 **开箱即用**: 支持npx一键运行

## 🚀 快速开始

### 1. 安装

```bash
# 全局安装
npm install -g aigroup-aliyunoss-mcp

# 或者使用 npx 临时运行
npx aigroup-aliyunoss-mcp --help
```

### 2. 配置OSS凭据

创建 `.env` 文件或设置环境变量：

```bash
# 阿里云OSS配置
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret  
OSS_BUCKET=your_bucket_name
OSS_REGION=oss-cn-beijing

# 可选配置
OSS_SECURE=true
OSS_TIMEOUT=300
FILE_EXPIRY_HOURS=1
```

### 3. 添加到MCP配置

编辑MCP设置文件 (如 Claude Desktop):

```json
{
  "mcpServers": {
    "aigroup-aliyunoss-mcp": {
      "command": "npx",
      "args": ["aigroup-aliyunoss-mcp", "--stdio"],
      "env": {
        "OSS_ACCESS_KEY_ID": "your_access_key_id",
        "OSS_ACCESS_KEY_SECRET": "your_access_key_secret",
        "OSS_BUCKET": "your_bucket_name", 
        "OSS_REGION": "oss-cn-beijing"
      }
    }
  }
}
```

### 4. 验证安装

```bash
# 健康检查
npx aigroup-aliyunoss-mcp --health

# 查看帮助
npx aigroup-aliyunoss-mcp --help

# 验证配置
npx aigroup-aliyunoss-mcp --validate-config
```

## 🔧 配置详解

### 环境变量

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `OSS_ACCESS_KEY_ID` | ✅ | - | 阿里云访问密钥ID |
| `OSS_ACCESS_KEY_SECRET` | ✅ | - | 阿里云访问密钥Secret |
| `OSS_BUCKET` | ✅ | - | OSS存储桶名称 |
| `OSS_REGION` | ✅ | - | OSS地域 (如: oss-cn-beijing) |
| `OSS_SECURE` | ❌ | true | 是否使用HTTPS |
| `OSS_TIMEOUT` | ❌ | 300 | 请求超时时间(秒) |
| `FILE_EXPIRY_HOURS` | ❌ | 1 | 临时链接有效期(小时) |
| `MCP_LOG_LEVEL` | ❌ | info | 日志级别 (debug/info/warn/error) |
| `MCP_MAX_FILE_SIZE` | ❌ | 100 | 最大文件大小(MB) |
| `MULTIPART_THRESHOLD` | ❌ | 10 | 分片上传阈值(MB) |

### 获取阿里云OSS凭据

1. 登录 [阿里云控制台](https://oss.console.aliyun.com/)
2. 创建或选择一个OSS存储桶
3. 在 [RAM访问控制](https://ram.console.aliyun.com/) 中创建用户
4. 为用户分配OSS相关权限
5. 生成访问密钥对

## 📋 可用工具

| 工具名称 | 功能描述 | 主要参数 |
|---------|---------|---------|
| `uploadFile` | 上传文件到OSS | fileName, file, contentType |
| `downloadFile` | 从OSS下载文件 | fileName, localPath |
| `deleteObject` | 删除OSS文件 | fileName |
| `deleteMultipleObjects` | 批量删除文件 | fileNames[] |
| `listObjects` | 列出OSS文件 | prefix, maxKeys, marker |
| `getObjectUrl` | 生成临时访问链接 | fileName, expires |
| `copyObject` | 复制OSS文件 | source, target |
| `getObjectMeta` | 获取文件元数据 | fileName |
| `putObjectACL` | 设置文件权限 | fileName, acl |
| `getObjectACL` | 获取文件权限 | fileName |
| `multipartUpload` | 分片上传大文件 | fileName, filePath, partSize |
| `initMultipartUpload` | 初始化分片上传 | fileName |
| `uploadPart` | 上传文件分片 | fileName, uploadId, partNo, data |
| `completeMultipartUpload` | 完成分片上传 | fileName, uploadId, parts |
| `abortMultipartUpload` | 取消分片上传 | fileName, uploadId |
| `listUploads` | 列出进行中的分片上传 | prefix, maxUploads |

## 💡 使用示例

### 基础文件操作

```javascript
// 上传文件
{
  "tool": "uploadFile",
  "arguments": {
    "fileName": "documents/report.pdf",
    "file": "/local/path/to/report.pdf",
    "contentType": "application/pdf"
  }
}

// 生成临时下载链接
{
  "tool": "getObjectUrl", 
  "arguments": {
    "fileName": "documents/report.pdf",
    "expires": 3600
  }
}

// 列出文件
{
  "tool": "listObjects",
  "arguments": {
    "prefix": "documents/",
    "maxKeys": 50
  }
}
```

### 批量操作

```javascript
// 批量删除文件
{
  "tool": "deleteMultipleObjects",
  "arguments": {
    "fileNames": [
      "temp/file1.txt",
      "temp/file2.txt", 
      "temp/file3.txt"
    ]
  }
}
```

### 分片上传大文件

```javascript
// 自动分片上传
{
  "tool": "multipartUpload",
  "arguments": {
    "fileName": "videos/large-video.mp4",
    "filePath": "/local/path/to/large-video.mp4",
    "partSize": 5242880
  }
}
```

## 🔍 监控和诊断

### 健康检查

```bash
# 完整健康检查
npx aigroup-aliyunoss-mcp --health

# JSON格式输出
npx aigroup-aliyunoss-mcp --health --json
```

健康检查包括：
- ✅ 配置验证
- ✅ OSS连接测试  
- ✅ 内存使用监控
- ✅ 依赖服务状态

### 日志记录

服务支持结构化JSON日志，输出到stderr：

```json
{
  "timestamp": "2025-08-18T12:00:00.000Z",
  "level": "info",
  "component": "UploadTool", 
  "message": "文件上传成功",
  "fileName": "test.jpg",
  "size": 102400,
  "duration": 1250,
  "traceId": "abc123def456"
}
```

### 性能监控

- **响应时间**: 每个工具调用的耗时统计
- **吞吐量**: 文件传输速率监控
- **错误率**: 操作失败率统计
- **资源使用**: 内存和CPU使用率

## 🛠️ 开发和自定义

### 本地开发

```bash
# 克隆项目
git clone https://github.com/your-org/aigroup-aliyunoss-mcp.git
cd aigroup-aliyunoss-mcp

# 安装依赖
npm install

# 配置环境
cp .env.example .env
# 编辑 .env 文件

# 开发模式运行
npm run dev
```

### 插件开发

创建自定义插件扩展功能：

```typescript
// plugins/my-plugin/index.ts
import { Plugin, PluginContext } from 'aigroup-aliyunoss-mcp';

export default class MyPlugin implements Plugin {
  metadata = {
    name: 'my-plugin',
    version: '1.0.0',
    description: '自定义插件',
    author: 'Your Name'
  };

  async onLoad(context: PluginContext) {
    context.logger.info('插件加载成功');
  }

  getTools() {
    return [{
      name: 'myCustomTool',
      description: '自定义工具',
      inputSchema: { /* zod schema */ },
      handler: async (args, context) => {
        // 工具逻辑
        return { success: true };
      }
    }];
  }
}
```

### 中间件开发

```typescript
// 自定义中间件
const customMiddleware: MiddlewareDefinition = {
  name: 'custom-middleware',
  priority: 500,
  handler: async (context, next) => {
    // 前置处理
    console.log(`调用工具: ${context.toolName}`);
    
    await next();
    
    // 后置处理
    console.log(`工具执行完成`);
  }
};
```

## 🐛 故障排除

### 常见问题

#### 1. OSS连接失败

**错误**: `OSS_CONNECTION_ERROR`

**解决方案**:
- 检查网络连接
- 验证OSS凭据是否正确
- 确认存储桶名称和地域设置
- 检查防火墙和代理设置

#### 2. 权限不足

**错误**: `OSS_PERMISSION_ERROR`

**解决方案**:
- 检查RAM用户权限设置
- 确认存储桶访问权限
- 验证访问密钥是否有效

#### 3. 文件上传失败

**错误**: `FILE_UPLOAD_FAILED`

**解决方案**:
- 检查文件路径是否正确
- 验证文件大小是否超出限制
- 检查文件类型是否被允许
- 增加超时时间配置

#### 4. 配置无效

**错误**: `CONFIG_INVALID`

**解决方案**:
- 运行 `npx aigroup-aliyunoss-mcp --validate-config`
- 检查必需的环境变量
- 验证配置文件格式

### 调试模式

```bash
# 启用调试日志
MCP_LOG_LEVEL=debug npx aigroup-aliyunoss-mcp --stdio

# 查看详细错误信息
npx aigroup-aliyunoss-mcp --health --verbose
```

### 获取支持

- 📖 [详细文档](https://your-org.github.io/aigroup-aliyunoss-mcp)
- 🐛 [问题反馈](https://github.com/your-org/aigroup-aliyunoss-mcp/issues)
- 💬 [讨论社区](https://github.com/your-org/aigroup-aliyunoss-mcp/discussions)
- 📧 [邮件支持](mailto:support@your-org.com)

## 🤝 贡献

欢迎贡献代码！请阅读 [贡献指南](CONTRIBUTING.md) 了解详情。

### 开发工作流

1. Fork 项目仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: 添加新功能'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 和 Prettier 规则
- 编写单元测试覆盖新功能
- 更新相关文档

## 📄 许可证

本项目使用 [MIT 许可证](LICENSE)。

## 🙏 致谢

- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP协议规范
- [阿里云OSS](https://www.aliyun.com/product/oss) - 对象存储服务
- [ali-oss](https://github.com/ali-sdk/ali-oss) - 阿里云OSS SDK

---

**Made with ❤️ by the aigroup-aliyunoss-mcp team**

[![Star History Chart](https://api.star-history.com/svg?repos=your-org/aigroup-aliyunoss-mcp&type=Date)](https://star-history.com/#your-org/aigroup-aliyunoss-mcp&Date)