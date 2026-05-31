# aliyunoss-cli

**文档版本**: 1.3.0
**最后更新**: 2026-05-31 16:08 CST
**变更摘要**: 补充 CLI 创建 OSS 软链接和绝对路径写法的用法示例。

## 应用说明

当前目录包含两个与阿里云 OSS 相关的运行形态：

### 1. aliyunoss-cli

- **入口**: `src/cli/index.ts`
- **包命令**: `aliyunoss-cli`
- **作用**: 通过命令行直接执行 OSS 文件管理操作，适合人工运维、脚本和 CI 任务。
- **主要能力**: 上传文件、生成临时访问链接、列出文件、复制文件、创建软链接、查询元数据、单文件删除、批量删除、配置校验和健康检查。

### 2. MCP stdio 兼容入口

- **入口**: `src/index.ts`，由 `aliyunoss-cli stdio` 或 `aliyunoss-cli --stdio` 触发。
- **兼容命令**: `aigroup-aliyunoss-mcp --stdio`
- **作用**: 过渡期保留旧 MCP 客户端接入方式，让支持 MCP 的 AI 客户端继续调用 OSS 工具。
- **策略**: CLI 是主入口；MCP stdio 仅作为兼容入口保留。

## 安装和构建

```bash
npm install
npm run build
```

本地运行 CLI：

```bash
npm run cli -- --help
node build/cli/index.js --help
```

包安装后运行：

```bash
aliyunoss-cli --help
aliyunoss-cli version
```

## 配置

运行前需要配置阿里云 OSS 环境变量：

```bash
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=your_bucket_name
OSS_REGION=oss-cn-beijing
OSS_SECURE=true
OSS_TIMEOUT=300
```

也可以将 OSS 凭据写入本地 JSON 文件，并在任意需要 OSS 配置的 CLI 命令中传入 `--credentials <path>`：

```json
{
  "accessKeyId": "your_access_key_id",
  "accessKeySecret": "your_access_key_secret",
  "bucket": "your_bucket_name",
  "region": "oss-cn-beijing"
}
```

支持的字段也包括 `OSS_ACCESS_KEY_ID`、`OSS_ACCESS_KEY_SECRET`、`OSS_BUCKET`、`OSS_REGION` 这类环境变量风格字段，以及 `{ "oss": { ... } }` 嵌套格式。显式传入的 `--credentials` 优先级高于环境变量。

校验配置：

```bash
aliyunoss-cli validate-config
aliyunoss-cli validate-config --json
aliyunoss-cli validate-config --credentials ./credentials.json --json
aliyunoss-cli health
aliyunoss-cli health --credentials ./credentials.json
```

配置校验和 JSON 输出会对密钥做脱敏处理，不输出完整 `accessKeySecret`。

## 常用命令

```bash
aliyunoss-cli upload ./report.pdf --key documents/report.pdf
aliyunoss-cli url documents/report.pdf --expires 3600
aliyunoss-cli list --prefix documents/ --max-keys 100 --json
aliyunoss-cli copy documents/a.pdf documents/b.pdf --no-overwrite
aliyunoss-cli symlink documents/report.pdf /latest/report.pdf --no-overwrite
aliyunoss-cli meta documents/report.pdf
aliyunoss-cli list --credentials ./credentials.json --prefix documents/ --json
```

`symlink` 命令用于创建 OSS 软链接对象，参数顺序为 `<target-key> <symlink-key>`。软链接路径和目标路径支持以单个 `/` 开头的 Bucket 根路径写法，例如 `/latest/report.pdf` 会按 `latest/report.pdf` 写入 OSS；`//latest/report.pdf`、`/`、包含 `..` 的路径仍会被拒绝。

删除命令默认有二次确认保护：

```bash
aliyunoss-cli delete documents/report.pdf
aliyunoss-cli delete documents/report.pdf --yes
aliyunoss-cli delete-many --file ./delete-list.txt --dry-run
aliyunoss-cli delete-many --file ./delete-list.txt --yes
```

`delete-many` 的清单文件一行一个 object key，命令会跳过空行、去重并限制单次最多 1000 个 object key。非交互式终端执行删除时必须显式传入 `--yes` 或 `--dry-run`。

## MCP 兼容用法

```bash
aliyunoss-cli stdio
aliyunoss-cli --stdio
aigroup-aliyunoss-mcp --stdio
```

Claude Desktop 等 MCP 客户端可继续使用 stdio 方式：

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

## 验证

```bash
npm run lint
npm run typecheck
npm run build
npm test
node build/cli/index.js --help
npm run pack:check
```
