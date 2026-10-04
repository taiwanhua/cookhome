/**
 * 測試專用的 CLI 進入點:與 prepare.mjs 的直接執行完全相同,只多注入 io.toolLimits 放寬生成碼的字元上限。
 * apply 的生成碼目前超過工具的 50,000 字元上限(正式入口會以 EXECUTION_SOURCE_TOO_LARGE 拒絕);
 * 這裡讓 apply → record → receipt 的流程仍能在 fake Figma 驗證邏輯。128 KiB 的完整 arguments 上限不放寬。
 */
import { main } from "./prepare.mjs";

process.exitCode = main(process.argv.slice(2), {
  stdout: process.stdout,
  stderr: process.stderr,
  cwd: process.cwd(),
  toolLimits: { codeChars: Number.MAX_SAFE_INTEGER },
});
