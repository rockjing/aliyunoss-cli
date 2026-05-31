# aliyunoss-cli 真实 OSS 冒烟测试用例

**文档版本**: 1.0.0
**最后更新**: 2026-05-29 20:25 CST
**变更摘要**: 新增 aliyunoss-cli 真实 OSS 冒烟测试用例说明，覆盖配置、上传、列表、元数据、临时 URL、复制、删除保护和安全负例。

## 定位

本目录用于放置真实外部依赖的冒烟测试，不属于默认 `npm test` 单元测试范围。

推荐原因：

- 真实 OSS 测试需要有效 `OSS_*` 凭据和网络。
- 测试会在 OSS 中创建和删除对象，不能默认随 Jest 自动执行。
- 冒烟测试更适合手动验收、预发布检查或受控 CI job。

## 安全约束

- 只使用 `aliyunoss-cli-smoke/` 前缀下的 object key。
- 删除命令必须先执行 `--dry-run`，再执行 `--yes`。
- 脚本会在失败时尝试清理已创建对象。
- 推荐使用测试 Bucket 或只授予测试前缀权限的 RAM 用户。

## 前置条件

```bash
npm install
npm run build

export OSS_ACCESS_KEY_ID=your_access_key_id
export OSS_ACCESS_KEY_SECRET=your_access_key_secret
export OSS_BUCKET=your_bucket_name
export OSS_REGION=oss-cn-beijing
```

可选指定测试前缀：

```bash
export ALIYUNOSS_SMOKE_PREFIX=aliyunoss-cli-smoke/manual-001
```

## 运行方式

```bash
npm run smoke:cli
```

如使用自定义构建产物或全局命令：

```bash
ALIYUNOSS_CLI_BIN=build/cli/index.js npm run smoke:cli
```

## 测试用例

| ID | 用例 | 命令/动作 | 期望结果 |
|----|------|-----------|----------|
| CLI-SMOKE-001 | 帮助信息 | `aliyunoss-cli --help` | 输出包含 `upload`、`delete-many`、`stdio`。 |
| CLI-SMOKE-002 | 版本信息 | `aliyunoss-cli version` | 输出与 `package.json` 版本一致。 |
| CLI-SMOKE-003 | 配置校验 | `aliyunoss-cli validate-config --json` | 返回 `success=true`，输出不包含完整 `OSS_ACCESS_KEY_SECRET`。 |
| CLI-SMOKE-004 | 健康检查 | `aliyunoss-cli health --json` | 返回结构化健康报告。 |
| CLI-SMOKE-005 | 上传文件 | `upload <tmp-file> --key <prefix>/a.txt --json` | OSS 返回上传成功，key 为测试前缀内对象。 |
| CLI-SMOKE-006 | 列表查询 | `list --prefix <prefix>/ --json` | 列表包含 `<prefix>/a.txt`。 |
| CLI-SMOKE-007 | 元数据查询 | `meta <prefix>/a.txt --json` | 返回对象 key、size、etag 等元数据。 |
| CLI-SMOKE-008 | 临时 URL | `url <prefix>/a.txt --expires 300 --json` | 返回可解析的 URL 和过期时间。 |
| CLI-SMOKE-009 | 复制对象 | `copy <prefix>/a.txt <prefix>/b.txt --no-overwrite --json` | 复制成功，列表可看到两个对象。 |
| CLI-SMOKE-010 | 单文件删除 dry-run | `delete <prefix>/a.txt --dry-run --json` | 返回 dry-run 预览，对象仍存在。 |
| CLI-SMOKE-011 | 单文件真实删除 | `delete <prefix>/a.txt --yes --json` | 删除成功，列表不再包含 `<prefix>/a.txt`。 |
| CLI-SMOKE-012 | 批量删除 dry-run | `delete-many --file <list-file> --dry-run --json` | 返回 dry-run 预览，清单对象仍存在。 |
| CLI-SMOKE-013 | 批量真实删除 | `delete-many --file <list-file> --yes --json` | 删除成功，测试前缀下对象清空。 |
| CLI-SMOKE-014 | 非法 key 拒绝 | `delete ../bad.txt --yes --json` | 返回失败，退出码非 0。 |
| CLI-SMOKE-015 | 编码绕过拒绝 | `delete ..%2Fbad.txt --yes --json` | 返回失败，退出码非 0。 |
| CLI-SMOKE-016 | 非 TTY 删除保护 | `delete <prefix>/no-confirm.txt --json` | 返回 `CONFIRMATION_REQUIRED`，退出码为 2。 |

## 跳过健康检查

如果测试 RAM 用户只允许对象级操作，`health` 可能因权限边界失败。可临时跳过：

```bash
ALIYUNOSS_SMOKE_SKIP_HEALTH=1 npm run smoke:cli
```
