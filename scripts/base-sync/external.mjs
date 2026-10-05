/**
 * 外部系統邊界:只允許 gh。固定執行檔 + 參數陣列,不經 shell;沿用使用者既有的 gh 登入,本工具不讀 token。
 * 測試以相同簽名的假實作替換。
 */
import { spawnSync } from "node:child_process";

const ALLOWED = new Set(["gh"]);

export function runExternalCommand(command, args, { cwd, env, input } = {}) {
  if (!ALLOWED.has(command)) {
    return { status: null, stdout: "", stderr: "" };
  }
  const result = spawnSync(command, args, {
    cwd,
    env: env ?? process.env,
    input,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    status: result.error ? null : result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}
