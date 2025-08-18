# 阿里云OSS MCP服务部署指南

## 📋 目录

- [环境要求](#环境要求)
- [安装方式](#安装方式)
- [配置设置](#配置设置)
- [MCP集成](#mcp集成)
- [Docker部署](#docker部署)
- [生产环境部署](#生产环境部署)
- [监控和维护](#监控和维护)
- [故障排除](#故障排除)

## 🔧 环境要求

### 系统要求

- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **操作系统**: Windows 10+, macOS 10.15+, Linux (Ubuntu 18.04+)
- **内存**: 最小 512MB, 推荐 1GB+
- **存储**: 最小 100MB 可用空间

### 阿里云OSS要求

- 有效的阿里云账号
- 已创建的OSS存储桶
- RAM用户与适当的OSS权限
- 网络连接到阿里云OSS服务

## 📦 安装方式

### 方式 1: 全局安装

```bash
# 安装
npm install -g alioss-mcp

# 验证安装
alioss-mcp --version
alioss-mcp --help
```

**优点**:
- 系统全局可用
- 命令行直接调用
- 适合个人开发环境

**缺点**:
- 需要管理员权限
- 版本更新需要手动操作

### 方式 2: npx临时运行

```bash
# 直接运行，无需安装
npx alioss-mcp --help
npx alioss-mcp --stdio

# 指定版本运行
npx alioss-mcp@latest --stdio
```

**优点**:
- 无需安装，即用即走
- 自动使用最新版本
- 适合CI/CD环境

**缺点**:
- 首次运行需要下载
- 网络依赖较强

### 方式 3: 项目依赖

```bash
# 添加到项目依赖
npm install alioss-mcp

# package.json scripts
{
  "scripts": {
    "mcp": "alioss-mcp --stdio",
    "mcp:health": "alioss-mcp --health"
  }
}

# 运行
npm run mcp
```

**优点**:
- 版本锁定，环境一致
- 团队协作友好
- 便于版本管理

**缺点**:
- 增加项目依赖大小
- 需要配置scripts

## ⚙️ 配置设置

### 1. 环境变量配置

#### 基础配置文件 (`.env`)

```bash
# === 必需配置 ===
OSS_ACCESS_KEY_ID=LTAI5tXXXXXXXXXXXXXX
OSS_ACCESS_KEY_SECRET=y0p2XXXXXXXXXXXXXXXXXXXXXXXX
OSS_BUCKET=your-bucket-name
OSS_REGION=oss-cn-beijing

# === 可选配置 ===
# OSS连接配置
OSS_SECURE=true
OSS_TIMEOUT=300

# 文件配置
FILE_EXPIRY_HOURS=1
MCP_MAX_FILE_SIZE=100
MCP_ALLOWED_EXTENSIONS=.jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt,.md

# 日志配置
MCP_LOG_LEVEL=info
MCP_TEMP_DIR=/tmp/alioss-mcp

# 分片上传配置
MULTIPART_THRESHOLD=10
MULTIPART_PART_SIZE=1
MULTIPART_PARALLEL=3

# 性能配置
CACHE_TTL=3600
CACHE_MAX_SIZE=1000
```

#### 配置验证

```bash
# 验证配置
npx alioss-mcp --validate-config

# 输出示例
✅ OSS连接配置有效
✅ 存储桶访问正常
✅ 权限验证通过
✅ 所有配置项验证成功
```

### 2. 获取阿里云OSS凭据

#### 步骤 1: 创建OSS存储桶

1. 登录 [阿里云OSS控制台](https://oss.console.aliyun.com/)
2. 点击"创建Bucket"
3. 配置存储桶信息:
   - **Bucket名称**: 全局唯一，如 `my-app-storage`
   - **地域**: 选择靠近用户的地域，如 `华北2（北京）`
   - **存储类型**: 根据需求选择，通常选择"标准存储"
   - **权限**: 推荐选择"私有"

#### 步骤 2: 创建RAM用户

1. 进入 [RAM访问控制台](https://ram.console.aliyun.com/)
2. 点击"用户" → "创建用户"
3. 配置用户信息:
   - **登录名称**: `alioss-mcp-user`
   - **显示名称**: `阿里云OSS MCP服务用户`
   - **访问方式**: 勾选"编程访问"

#### 步骤 3: 配置权限策略

推荐的权限策略（最小权限原则）:

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
        "oss:PutObjectAcl",
        "oss:GetObjectAcl",
        "oss:CopyObject",
        "oss:InitiateMultipartUpload",
        "oss:UploadPart",
        "oss:CompleteMultipartUpload",
        "oss:AbortMultipartUpload",
        "oss:ListMultipartUploads",
        "oss:ListParts"
      ],
      "Resource": [
        "acs:oss:*:*:your-bucket-name",
        "acs:oss:*:*:your-bucket-name/*"
      ]
    }
  ]
}
```

#### 步骤 4: 生成访问密钥

1. 在RAM用户列表中找到创建的用户
2. 点击用户名称进入详情页
3. 点击"创建AccessKey"
4. 安全保存 AccessKey ID 和 AccessKey Secret

### 3. 配置文件层级

配置加载优先级（从高到低）:

1. **环境变量** - 系统环境变量
2. **命令行参数** - CLI传入的参数
3. **本地.env文件** - 项目根目录的.env文件
4. **全局配置文件** - ~/.alioss-mcp/config.json
5. **默认配置** - 代码中的默认值

## 🔌 MCP集成

### 1. Claude Desktop 集成

#### 配置文件位置

- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`

#### 配置示例

```json
{
  "mcpServers": {
    "alioss-mcp": {
      "command": "npx",
      "args": ["alioss-mcp", "--stdio"],
      "env": {
        "OSS_ACCESS_KEY_ID": "LTAI5tXXXXXXXXXXXXXX",
        "OSS_ACCESS_KEY_SECRET": "y0p2XXXXXXXXXXXXXXXXXXXXXXXX",
        "OSS_BUCKET": "your-bucket-name",
        "OSS_REGION": "oss-cn-beijing",
        "MCP_LOG_LEVEL": "info"
      },
      "disabled": false,
      "alwaysAllow": [],
      "disabledTools": []
    }
  }
}
```

#### 高级配置选项

```json
{
  "mcpServers": {
    "alioss-mcp": {
      "command": "npx",
      "args": ["alioss-mcp", "--stdio"],
      "env": {
        "OSS_ACCESS_KEY_ID": "LTAI5tXXXXXXXXXXXXXX",
        "OSS_ACCESS_KEY_SECRET": "y0p2XXXXXXXXXXXXXXXXXXXXXXXX",
        "OSS_BUCKET": "your-bucket-name",
        "OSS_REGION": "oss-cn-beijing",
        "OSS_TIMEOUT": "600",
        "FILE_EXPIRY_HOURS": "2",
        "MCP_LOG_LEVEL": "debug",
        "MCP_MAX_FILE_SIZE": "200",
        "MULTIPART_THRESHOLD": "20"
      },
      "disabled": false,
      "timeout": 120,
      "alwaysAllow": [
        "listObjects",
        "getObjectMeta"
      ],
      "disabledTools": [
        "deleteMultipleObjects"
      ]
    }
  }
}
```

### 2. 其他MCP客户端集成

#### VS Code Roo-Cline

配置文件: `~/.roo/mcp_settings.json`

```json
{
  "mcpServers": {
    "alioss-mcp": {
      "command": "node",
      "args": ["/usr/local/lib/node_modules/alioss-mcp/build/index.js"],
      "env": {
        "OSS_ACCESS_KEY_ID": "your_key_id",
        "OSS_ACCESS_KEY_SECRET": "your_key_secret",
        "OSS_BUCKET": "your_bucket",
        "OSS_REGION": "oss-cn-beijing"
      }
    }
  }
}
```

#### 自定义MCP客户端

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['alioss-mcp', '--stdio'],
  env: {
    OSS_ACCESS_KEY_ID: 'your_key_id',
    OSS_ACCESS_KEY_SECRET: 'your_key_secret',
    OSS_BUCKET: 'your_bucket',
    OSS_REGION: 'oss-cn-beijing'
  }
});

const client = new Client({
  name: 'my-app',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);
```

## 🐳 Docker部署

### 1. 基础Docker镜像

#### Dockerfile

```dockerfile
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装alioss-mcp
RUN npm install -g alioss-mcp

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S alioss -u 1001

# 切换到非root用户
USER alioss

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD alioss-mcp --health || exit 1

# 启动命令
CMD ["alioss-mcp", "--stdio"]
```

#### 构建和运行

```bash
# 构建镜像
docker build -t alioss-mcp:latest .

# 运行容器
docker run -d \
  --name alioss-mcp \
  -e OSS_ACCESS_KEY_ID=your_key_id \
  -e OSS_ACCESS_KEY_SECRET=your_key_secret \
  -e OSS_BUCKET=your_bucket \
  -e OSS_REGION=oss-cn-beijing \
  alioss-mcp:latest
```

### 2. Docker Compose部署

#### docker-compose.yml

```yaml
version: '3.8'

services:
  alioss-mcp:
    image: alioss-mcp:latest
    container_name: alioss-mcp
    restart: unless-stopped
    environment:
      - OSS_ACCESS_KEY_ID=${OSS_ACCESS_KEY_ID}
      - OSS_ACCESS_KEY_SECRET=${OSS_ACCESS_KEY_SECRET}
      - OSS_BUCKET=${OSS_BUCKET}
      - OSS_REGION=${OSS_REGION}
      - MCP_LOG_LEVEL=info
    volumes:
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "alioss-mcp", "--health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - mcp-network

networks:
  mcp-network:
    driver: bridge
```

#### 环境变量文件 (.env)

```bash
OSS_ACCESS_KEY_ID=your_key_id
OSS_ACCESS_KEY_SECRET=your_key_secret
OSS_BUCKET=your_bucket
OSS_REGION=oss-cn-beijing
```

#### 部署命令

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f alioss-mcp

# 停止服务
docker-compose down
```

## 🏭 生产环境部署

### 1. 系统服务部署

#### Systemd服务 (Linux)

创建服务文件: `/etc/systemd/system/alioss-mcp.service`

```ini
[Unit]
Description=Aliyun OSS MCP Server
After=network.target
Wants=network.target

[Service]
Type=simple
User=alioss-mcp
Group=alioss-mcp
WorkingDirectory=/opt/alioss-mcp
ExecStart=/usr/bin/node /usr/local/lib/node_modules/alioss-mcp/build/index.js --stdio
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=alioss-mcp

# 环境变量
Environment=OSS_ACCESS_KEY_ID=your_key_id
Environment=OSS_ACCESS_KEY_SECRET=your_key_secret
Environment=OSS_BUCKET=your_bucket
Environment=OSS_REGION=oss-cn-beijing
Environment=MCP_LOG_LEVEL=info

# 安全设置
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/alioss-mcp/logs

[Install]
WantedBy=multi-user.target
```

#### 服务管理命令

```bash
# 重载systemd配置
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start alioss-mcp

# 设置开机自启
sudo systemctl enable alioss-mcp

# 查看服务状态
sudo systemctl status alioss-mcp

# 查看服务日志
sudo journalctl -u alioss-mcp -f
```

### 2. PM2进程管理

#### 安装PM2

```bash
npm install -g pm2
```

#### PM2配置文件 (ecosystem.config.js)

```javascript
module.exports = {
  apps: [{
    name: 'alioss-mcp',
    script: '/usr/local/lib/node_modules/alioss-mcp/build/index.js',
    args: '--stdio',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      OSS_ACCESS_KEY_ID: 'your_key_id',
      OSS_ACCESS_KEY_SECRET: 'your_key_secret',
      OSS_BUCKET: 'your_bucket',
      OSS_REGION: 'oss-cn-beijing',
      MCP_LOG_LEVEL: 'info'
    },
    log_file: '/var/log/alioss-mcp/combined.log',
    out_file: '/var/log/alioss-mcp/out.log',
    error_file: '/var/log/alioss-mcp/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

#### PM2管理命令

```bash
# 启动应用
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs alioss-mcp

# 重启应用
pm2 restart alioss-mcp

# 停止应用
pm2 stop alioss-mcp

# 设置开机自启
pm2 startup
pm2 save
```

### 3. 负载均衡部署

#### Nginx配置

```nginx
upstream alioss_mcp {
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}

server {
    listen 80;
    server_name alioss-mcp.yourdomain.com;

    location / {
        proxy_pass http://alioss_mcp;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 健康检查端点
    location /health {
        proxy_pass http://alioss_mcp/health;
        access_log off;
    }
}
```

## 📊 监控和维护

### 1. 健康检查监控

#### 脚本监控

```bash
#!/bin/bash
# health-check.sh

HEALTH_ENDPOINT="http://localhost:3000/health"
LOG_FILE="/var/log/alioss-mcp/health.log"

# 执行健康检查
RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/health_response "$HEALTH_ENDPOINT")
HTTP_CODE="${RESPONSE: -3}"

if [ "$HTTP_CODE" -eq 200 ]; then
    echo "$(date): Health check passed" >> "$LOG_FILE"
else
    echo "$(date): Health check failed with code $HTTP_CODE" >> "$LOG_FILE"
    # 发送告警通知
    /usr/local/bin/send-alert.sh "alioss-mcp health check failed"
fi
```

#### Cron定时检查

```bash
# 添加到crontab
# 每分钟执行健康检查
* * * * * /opt/alioss-mcp/scripts/health-check.sh

# 每小时清理日志
0 * * * * find /var/log/alioss-mcp -name "*.log" -mtime +7 -delete
```

### 2. 日志管理

#### 日志轮转 (logrotate)

创建配置文件: `/etc/logrotate.d/alioss-mcp`

```
/var/log/alioss-mcp/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 alioss-mcp alioss-mcp
    postrotate
        /bin/kill -USR1 $(cat /var/run/alioss-mcp.pid 2>/dev/null) 2>/dev/null || true
    endscript
}
```

#### 日志聚合 (ELK Stack)

Filebeat配置 (`filebeat.yml`):

```yaml
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/log/alioss-mcp/*.log
  fields:
    service: alioss-mcp
    environment: production
  multiline.pattern: '^\{'
  multiline.negate: true
  multiline.match: after

output.elasticsearch:
  hosts: ["localhost:9200"]
  index: "alioss-mcp-%{+yyyy.MM.dd}"

logging.level: info
logging.to_files: true
logging.files:
  path: /var/log/filebeat
  name: filebeat
  keepfiles: 7
  permissions: 0644
```

### 3. 性能监控

#### Prometheus监控指标

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'alioss-mcp'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: /metrics
    scrape_interval: 30s
```

#### Grafana仪表板

关键监控指标:
- 请求响应时间
- 请求成功率
- 文件传输速率
- 内存使用情况
- CPU使用率
- 活跃连接数

## 🔧 故障排除

### 1. 常见部署问题

#### 问题 1: 权限错误

**症状**: `EACCES: permission denied`

**解决方案**:
```bash
# 检查文件权限
ls -la /usr/local/lib/node_modules/alioss-mcp

# 修复权限
sudo chown -R $(whoami) /usr/local/lib/node_modules/alioss-mcp
sudo chmod +x /usr/local/lib/node_modules/alioss-mcp/build/index.js
```

#### 问题 2: 端口冲突

**症状**: `EADDRINUSE: address already in use`

**解决方案**:
```bash
# 查找占用端口的进程
sudo netstat -tulpn | grep :3000
sudo lsof -i :3000

# 终止进程
sudo kill -9 <PID>

# 或更换端口
export PORT=3001
```

#### 问题 3: 环境变量未加载

**症状**: `CONFIG_MISSING: Required environment variable OSS_ACCESS_KEY_ID is not set`

**解决方案**:
```bash
# 检查环境变量
env | grep OSS_

# 重新设置环境变量
export OSS_ACCESS_KEY_ID=your_key_id
export OSS_ACCESS_KEY_SECRET=your_key_secret

# 验证配置
npx alioss-mcp --validate-config
```

### 2. 性能问题诊断

#### 内存泄漏检查

```bash
# 使用Node.js内置性能分析
node --inspect /usr/local/lib/node_modules/alioss-mcp/build/index.js

# 生成heap快照
kill -USR2 <PID>

# 分析内存使用
npm install -g clinic
clinic doctor -- node build/index.js --stdio
```

#### 网络连接问题

```bash
# 测试OSS连接
curl -I https://your-bucket.oss-cn-beijing.aliyuncs.com

# 检查DNS解析
nslookup your-bucket.oss-cn-beijing.aliyuncs.com

# 测试网络延迟
ping oss-cn-beijing.aliyuncs.com
```

### 3. 日志分析

#### 错误模式识别

```bash
# 统计错误类型
grep "ERROR" /var/log/alioss-mcp/*.log | \
  grep -o '"code":"[^"]*"' | \
  sort | uniq -c | sort -nr

# 分析响应时间
grep "duration" /var/log/alioss-mcp/*.log | \
  grep -o '"duration":[0-9]*' | \
  awk -F: '{sum+=$2; count++} END {print "Average:", sum/count "ms"}'

# 查找超时请求
grep "timeout" /var/log/alioss-mcp/*.log | \
  grep -o '"toolName":"[^"]*"' | \
  sort | uniq -c
```

### 4. 紧急恢复程序

#### 服务快速恢复

```bash
#!/bin/bash
# emergency-recovery.sh

echo "开始紧急恢复程序..."

# 1. 停止服务
sudo systemctl stop alioss-mcp
pm2 stop alioss-mcp

# 2. 备份当前版本
sudo cp -r /usr/local/lib/node_modules/alioss-mcp \
  /backup/alioss-mcp-$(date +%Y%m%d_%H%M%S)

# 3. 重新安装最新版本
sudo npm uninstall -g alioss-mcp
sudo npm install -g alioss-mcp@latest

# 4. 验证配置
alioss-mcp --validate-config

# 5. 重启服务
sudo systemctl start alioss-mcp
pm2 start alioss-mcp

# 6. 验证服务状态
sleep 10
alioss-mcp --health

echo "紧急恢复完成!"
```

#### 数据备份恢复

```bash
# 备份配置文件
tar -czf config-backup-$(date +%Y%m%d).tar.gz \
  ~/.alioss-mcp/ \
  /etc/systemd/system/alioss-mcp.service \
  /opt/alioss-mcp/

# 恢复配置文件
tar -xzf config-backup-20250818.tar.gz -C /
```

---

**部署指南版本**: v1.0.0  
**最后更新**: 2025-08-18  
**适用版本**: alioss-mcp v1.0.0+