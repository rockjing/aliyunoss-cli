# aigroup-aliyunoss-mcp

**文档版本**: 1.0.0
**最后更新**: 2026-05-29 17:50 CST
**变更摘要**: 创建简要 README，说明当前目录下两个应用形态的作用。

## 应用说明

当前目录主要包含两个与阿里云 OSS 相关的应用形态：

### 1. 阿里云 OSS MCP 服务

- **入口**: `src/index.ts`
- **作用**: 启动一个基于 Model Context Protocol 的 stdio 服务，让支持 MCP 的 AI 客户端可以调用阿里云 OSS 能力。
- **主要能力**: 上传文件、生成临时访问链接、删除文件、批量删除、列出文件、复制文件、查询文件元数据。
- **适用场景**: 需要让 AI 助手通过标准 MCP 工具访问和管理阿里云 OSS 文件。

### 2. OSS 存储服务封装

- **入口**: `oss.ts`
- **作用**: 对 `ali-oss` SDK 做一层较轻量的封装，提供直接面向 OSS 的基础文件操作能力。
- **主要能力**: 上传文件、生成临时下载链接、删除文件、列出过期文件、读取文件内容。
- **适用场景**: 需要在业务代码中直接复用 OSS 上传、下载链接生成、清理和读取能力。

## 运行方式

安装依赖后，可通过 npm 脚本构建或启动 MCP 服务：

```bash
npm install
npm run build
npm run start
```

运行前需要配置阿里云 OSS 相关环境变量：

```bash
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=your_bucket_name
OSS_REGION=oss-cn-beijing
```
