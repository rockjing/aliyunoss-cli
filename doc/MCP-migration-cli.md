# MCP 转 CLI 工具需求

**文档版本**: 1.1.1
**最后更新**: 2026-05-29 18:00 CST
**变更摘要**: 将 CLI 工具正式命名为 `aliyunoss-cli`，并同步更新命令示例和迁移要求。

## 需求说明

将当前阿里云 OSS MCP 服务转换为 CLI 工具，使用户可以通过命令行直接调用 OSS 文件管理能力。

## 核心目标

- 保留现有 OSS 能力，包括上传文件、生成临时访问链接、删除文件、批量删除、列出文件、复制文件和查询文件元数据。
- 将 MCP 工具调用方式迁移为命令行参数或子命令形式。
- CLI 工具统一命名为 `aliyunoss-cli`。
- 继续复用当前配置能力，通过环境变量读取阿里云 OSS 凭据和运行参数。
- 输出命令执行结果，便于人工查看或脚本集成。

## 预期结果

迁移完成后，用户无需 MCP 客户端即可通过 CLI 操作阿里云 OSS。

## 技术方案

### 1. 总体思路

将当前以 MCP Tool 为入口的调用链，调整为以命令行子命令为入口的调用链。

迁移后 CLI 仍复用现有配置加载、OSS 存储服务和工具参数校验逻辑，但不再依赖 MCP Client 发起工具调用。CLI 负责解析命令行参数、执行二次确认、调用对应 OSS 能力，并将结果以人类可读文本或 JSON 输出到终端。

### 2. 目标架构

```text
CLI 命令入口
  -> 命令参数解析
  -> 配置加载与校验
  -> 安全校验和删除确认
  -> OSSStorageService
  -> 阿里云 OSS SDK
  -> 终端输出
```

建议新增或调整的核心模块：

| 模块 | 作用 |
|------|------|
| `src/cli/index.ts` | CLI 主入口，负责注册子命令、解析参数和统一错误处理。 |
| `src/cli/commands/*.ts` | 各 OSS 操作的命令实现，例如上传、列表、删除、复制、元数据查询。 |
| `src/cli/output.ts` | 统一处理普通文本输出和 `--json` 输出。 |
| `src/cli/confirm.ts` | 删除等危险操作的二次确认逻辑。 |
| `src/security/object-key.ts` | 统一 OSS object key 校验，防止路径遍历和非法路径。 |
| `src/config/config.ts` | 继续负责环境变量和配置文件加载，但需要避免对外返回明文密钥。 |
| `src/storage/oss-storage.ts` | 继续作为 OSS SDK 封装层，被 CLI 命令直接调用。 |

### 3. CLI 命令设计

CLI 工具正式命名为 `aliyunoss-cli`：

```bash
aliyunoss-cli <command> [options]
```

命令映射如下：

| MCP 工具 | CLI 命令 | 说明 |
|----------|----------|------|
| `uploadFile` | `upload <local-file> --key <object-key>` | 上传本地文件到 OSS。 |
| `getObjectUrl` | `url <object-key>` | 生成临时访问链接。 |
| `deleteObject` | `delete <object-key>` | 删除单个 OSS 文件，默认需要二次确认。 |
| `deleteMultipleObjects` | `delete-many --file <list-file>` | 批量删除文件，默认需要二次确认。 |
| `listObjects` | `list [--prefix <prefix>]` | 按前缀列出 OSS 文件。 |
| `copyObject` | `copy <source-key> <target-key>` | 复制 OSS 文件。 |
| `getObjectMeta` | `meta <object-key>` | 查询 OSS 文件元数据。 |

命令示例：

```bash
aliyunoss-cli upload ./report.pdf --key documents/report.pdf
aliyunoss-cli url documents/report.pdf --expires 3600
aliyunoss-cli list --prefix documents/ --max-keys 100
aliyunoss-cli copy documents/a.pdf documents/b.pdf --no-overwrite
aliyunoss-cli meta documents/report.pdf
aliyunoss-cli delete documents/report.pdf
aliyunoss-cli delete-many --file ./delete-list.txt --yes
```

通用参数：

| 参数 | 说明 |
|------|------|
| `--json` | 以 JSON 输出结果，便于脚本消费。 |
| `--profile <name>` | 预留配置 profile 能力。 |
| `--config <path>` | 指定配置文件路径。 |
| `--log-level <level>` | 控制日志级别。 |
| `--dry-run` | 对删除、批量删除等危险操作只展示将执行的动作。 |
| `--yes` | 跳过交互式确认，适合 CI 或脚本场景。 |

### 4. 配置策略

继续复用当前环境变量：

```bash
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=your_bucket_name
OSS_REGION=oss-cn-beijing
OSS_SECURE=true
OSS_TIMEOUT=300
```

CLI 需要支持以下配置加载顺序：

1. 命令行参数。
2. 环境变量。
3. `.env` 文件。
4. 默认配置。

配置输出必须做脱敏处理。`validate-config` 或调试输出中只能展示 `accessKeyId` 的部分字符，不能输出完整 `accessKeySecret`。

### 5. 安全设计

本迁移需要同时处理 `Issue-to-fix.md` 中记录的安全问题。

#### 5.1 Object Key 校验

所有接收 OSS object key 的命令必须走统一校验方法，不允许各命令自行实现不一致的校验逻辑。

校验规则：

- 禁止空字符串。
- 禁止以 `/` 开头。
- 禁止 `.` 和 `..` 路径段。
- 禁止 `//` 连续分隔符。
- 禁止反斜杠 `\`。
- 禁止控制字符。
- URL decode 后再次校验，防止编码绕过。
- 长度不超过 OSS object key 上限。
- 如配置了允许前缀，例如 `OSS_KEY_PREFIX=uploads/`，所有 object key 必须落在该前缀下。

#### 5.2 删除确认

删除命令默认必须二次确认：

```bash
aliyunoss-cli delete documents/report.pdf
```

交互提示需要展示 bucket、region、object key 和操作类型。用户输入完整 object key 或明确确认词后才执行。

脚本场景可使用：

```bash
aliyunoss-cli delete documents/report.pdf --yes
```

批量删除必须额外支持：

- `--dry-run`：只打印即将删除的文件列表。
- `--file <list-file>`：从文件读取待删除列表，一行一个 object key。
- 删除前展示总数量和前若干条样例。
- 单次批量删除数量遵循当前 `deleteMultipleObjects` 的 1000 条上限。

#### 5.3 密钥保护

`ConfigManager` 不应通过 `getConfig()` 对外返回完整明文密钥。

建议拆分配置读取能力：

- `getOSSRuntimeConfig()`：仅供 OSS 客户端初始化使用，包含完整密钥。
- `getConfigSummary()` 或 `getPublicConfig()`：用于日志、调试和 CLI 输出，密钥脱敏。
- 避免在错误对象、日志上下文、JSON 输出中携带 `accessKeySecret`。

### 6. 输出设计

默认输出面向人工阅读，例如：

```text
Upload success
Key: documents/report.pdf
Size: 102400
URL: https://...
```

`--json` 输出保持稳定字段，便于脚本集成：

```json
{
  "success": true,
  "command": "upload",
  "data": {
    "fileName": "documents/report.pdf",
    "size": 102400
  }
}
```

错误输出规则：

- 普通模式输出简短错误信息到 `stderr`。
- JSON 模式输出 `{ "success": false, "error": { "code": "...", "message": "..." } }`。
- 参数错误退出码为 `2`。
- OSS 或网络错误退出码为 `1`。
- 用户取消删除退出码为 `130`。

### 7. 迁移步骤

1. 新增 CLI 入口和命令解析模块。
2. 抽取统一 object key 安全校验模块。
3. 将现有 MCP 工具能力映射为 CLI 子命令。
4. 为删除和批量删除增加确认、`--dry-run` 和 `--yes`。
5. 调整配置读取方式，区分运行时密钥配置和脱敏公开配置。
6. 更新 `package.json` 的 `bin`、`scripts` 和发布文件列表，将命令入口暴露为 `aliyunoss-cli`。
7. 保留或删除 MCP 入口：
   - 过渡期可保留 `--stdio`，方便兼容旧用法。
   - 最终版本可移除 MCP server 入口和 `@modelcontextprotocol/sdk` 依赖。
8. 更新 README 和部署文档中的使用方式。
9. 补充 CLI 命令测试、参数校验测试和危险操作确认测试。

### 8. 验收标准

- 用户可以通过 CLI 完成上传、生成临时链接、列表、复制、元数据查询、单文件删除和批量删除。
- CLI 对外命令名为 `aliyunoss-cli`，文档、脚本和发布配置中不再使用旧 MCP 命令名作为主入口。
- 所有 object key 参数都经过统一安全校验，`../`、`..%2F`、绝对路径和反斜杠路径均被拒绝。
- 删除操作默认需要二次确认，使用 `--yes` 时才允许非交互执行。
- 批量删除支持 `--dry-run`，并限制单次最多 1000 个 object key。
- CLI 支持普通文本和 `--json` 两种输出模式。
- 配置验证和错误日志不输出完整密钥。
- `npm run build`、类型检查和相关测试通过。
