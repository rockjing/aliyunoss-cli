# 待修复问题清单

**文档版本**: 1.0.0
**最后更新**: 2026-05-29 17:53 CST
**变更摘要**: 新建待修复问题文档，记录当前 OSS 工具相关安全与操作风险。

## 问题列表

| 问题 | 严重程度 | 详情 |
|------|----------|------|
| 路径遍历漏洞 | 🔴 高 | `oss.ts` 中 `filename` 参数完全未校验，直接传给 OSS SDK。攻击者可构造 `../../other-path/file` 遍历 bucket 内其他目录，理论上可读写/删除 bucket 内任意文件。 |
| 删除操作无二次确认 | 🔴 高 | `deleteObject` 和 `deleteMultipleObjects` 工具无任何确认机制、无回收站、无软删除，删了就是删了。 |
| 密钥明文存内存 | 🔴 中高 | `ConfigManager` 的 `config.oss.accessKeyId` 和 `accessKeySecret` 以明文存在内存中，`getConfig()` 返回浅拷贝，任意内部代码可获取完整密钥。 |
