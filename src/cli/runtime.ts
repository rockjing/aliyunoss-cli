/**
 * aliyunoss-cli - 运行时辅助
 *
 * @fileoverview 提供配置加载、控制台输出重定向等 CLI 运行辅助能力
 * @author aigroup-aliyunoss-mcp team
 * @version 1.0.0
 */

export async function withConsoleLogsOnStderr<T>(callback: () => Promise<T>): Promise<T> {
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;

  console.log = (...args: unknown[]) => console.error(...args);
  console.info = (...args: unknown[]) => console.error(...args);
  console.warn = (...args: unknown[]) => console.error(...args);

  try {
    return await callback();
  } finally {
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
  }
}
