# aliyunoss-cli 部署指南

**文档版本**: 1.1.0
**最后更新**: 2026-05-29 20:10 CST
**变更摘要**: 将部署说明更新为 CLI 主入口，保留 MCP stdio 兼容入口，并补充验证、打包和生产运行建议。

## 环境要求

- Node.js >= 18.0.0
- npm >= 8.0.0
- 已创建的阿里云 OSS Bucket
- 具备最小 OSS 权限的 RAM 用户
- 可访问阿里云 OSS endpoint 的网络环境

推荐 RAM 权限至少包含：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "oss:PutObject",
        "oss:GetObject",
        "oss:DeleteObject",
        "oss:ListObjects",
        "oss:GetObjectMeta",
        "oss:CopyObject"
      ],
      "Resource": [
        "acs:oss:*:*:your-bucket-name",
        "acs:oss:*:*:your-bucket-name/*"
      ]
    }
  ]
}
```

## 安装方式

### 全局安装

```bash
npm install -g aigroup-aliyunoss-mcp
aliyunoss-cli --help
aliyunoss-cli version
```

### npx 临时运行

```bash
npx aigroup-aliyunoss-mcp --help
npx aigroup-aliyunoss-mcp validate-config
```

如果需要显式运行 `aliyunoss-cli` bin，可使用：

```bash
npm exec --package=aigroup-aliyunoss-mcp -- aliyunoss-cli --help
```

`npx aigroup-aliyunoss-mcp` 会进入 CLI 入口；CLI 主命令仍是 `aliyunoss-cli`。

### 项目依赖

```bash
npm install aigroup-aliyunoss-mcp
```

```json
{
  "scripts": {
    "oss": "aliyunoss-cli",
    "oss:health": "aliyunoss-cli health",
    "oss:mcp": "aliyunoss-cli stdio"
  }
}
```

## 配置

通过环境变量配置 OSS 访问参数：

```bash
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=your_bucket_name
OSS_REGION=oss-cn-beijing
OSS_SECURE=true
OSS_TIMEOUT=300
```

配置校验：

```bash
aliyunoss-cli validate-config
aliyunoss-cli validate-config --json
aliyunoss-cli health
```

`validate-config` 输出的是脱敏摘要；运行时密钥只用于初始化 OSS 客户端，不会进入 CLI JSON 输出。

## CLI 使用

```bash
aliyunoss-cli upload ./report.pdf --key documents/report.pdf
aliyunoss-cli url documents/report.pdf --expires 3600
aliyunoss-cli list --prefix documents/ --max-keys 100
aliyunoss-cli copy documents/a.pdf documents/b.pdf --no-overwrite
aliyunoss-cli meta documents/report.pdf
```

删除类命令默认需要确认：

```bash
aliyunoss-cli delete documents/report.pdf
aliyunoss-cli delete documents/report.pdf --yes
aliyunoss-cli delete-many --file ./delete-list.txt --dry-run
aliyunoss-cli delete-many --file ./delete-list.txt --yes
```

非 TTY 环境执行删除时必须传入 `--yes` 或 `--dry-run`。`delete-many` 清单文件一行一个 object key，单次最多 1000 个。

## MCP stdio 兼容

迁移后 CLI 是主入口，MCP stdio 作为过渡兼容入口保留：

```bash
aliyunoss-cli stdio
aliyunoss-cli --stdio
aigroup-aliyunoss-mcp --stdio
```

Claude Desktop 示例：

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

## Docker 运行

```dockerfile
FROM node:20-alpine

WORKDIR /app
RUN npm install -g aigroup-aliyunoss-mcp

ENV NODE_ENV=production

ENTRYPOINT ["aliyunoss-cli"]
CMD ["--help"]
```

运行健康检查：

```bash
docker run --rm \
  -e OSS_ACCESS_KEY_ID=your_access_key_id \
  -e OSS_ACCESS_KEY_SECRET=your_access_key_secret \
  -e OSS_BUCKET=your_bucket_name \
  -e OSS_REGION=oss-cn-beijing \
  aigroup-aliyunoss-mcp:latest health
```

运行 MCP 兼容入口：

```bash
docker run --rm -i \
  -e OSS_ACCESS_KEY_ID=your_access_key_id \
  -e OSS_ACCESS_KEY_SECRET=your_access_key_secret \
  -e OSS_BUCKET=your_bucket_name \
  -e OSS_REGION=oss-cn-beijing \
  aigroup-aliyunoss-mcp:latest stdio
```

## 生产运行建议

### Systemd

CLI 命令适合按需执行；如需长期运行 MCP stdio 兼容入口，可使用 systemd：

```ini
[Unit]
Description=Aliyun OSS MCP stdio compatibility service
After=network.target

[Service]
Type=simple
User=aliyunoss
WorkingDirectory=/opt/aigroup-aliyunoss-mcp
ExecStart=/usr/bin/aliyunoss-cli stdio
Restart=always
RestartSec=10
Environment=OSS_ACCESS_KEY_ID=your_access_key_id
Environment=OSS_ACCESS_KEY_SECRET=your_access_key_secret
Environment=OSS_BUCKET=your_bucket_name
Environment=OSS_REGION=oss-cn-beijing
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### PM2

```javascript
module.exports = {
  apps: [
    {
      name: 'aliyunoss-cli-mcp-stdio',
      script: 'aliyunoss-cli',
      args: 'stdio',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        OSS_ACCESS_KEY_ID: 'your_access_key_id',
        OSS_ACCESS_KEY_SECRET: 'your_access_key_secret',
        OSS_BUCKET: 'your_bucket_name',
        OSS_REGION: 'oss-cn-beijing'
      }
    }
  ]
};
```

## 发布前验证

```bash
npm run lint
npm run typecheck
npm run build
npm test
node build/cli/index.js --help
npm run pack:check
```

`package.json` 当前发布文件保留 `README.md`、`doc/ARCHITECTURE.md`、`doc/DEPLOYMENT.md` 和 `doc/MCP-migration-cli.md`。`doc/planning/` 与 `doc/Issue-to-fix.md` 属于内部规划和安全整改记录，不进入发布文件列表。

## 故障排除

### 配置缺失

```bash
env | grep OSS_
aliyunoss-cli validate-config --json
```

### OSS 连接失败

```bash
aliyunoss-cli health --json
curl -I https://your-bucket.oss-cn-beijing.aliyuncs.com
```

### 删除命令在 CI 中失败

非交互式环境不会弹出确认提示。使用以下任一方式：

```bash
aliyunoss-cli delete documents/report.pdf --dry-run
aliyunoss-cli delete documents/report.pdf --yes
aliyunoss-cli delete-many --file ./delete-list.txt --dry-run
aliyunoss-cli delete-many --file ./delete-list.txt --yes
```
