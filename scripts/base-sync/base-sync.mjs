/**
 * 底座跨 repo 升級與回收的共用入口(操作正本:docs/deployment.md「底座首次接軌與版本升級」「共用改良回收」)。
 *
 *   inspect    --project <repo-root> --from <full-sha> --to <full-sha>
 *   upgrade    --project <repo-root> [--project <repo-root> ...] --tag <version> --worktree-root <dir>
 *   contribute --project <source-root> --commit <full-sha> --base <base-root> --worktree-root <dir>
 *
 * 成功:stdout 一個 JSON 物件、exit 0。失敗:stdout 空、stderr 一行安全摘要、exit 1。
 * 只準備隔離的 feature 工作樹;不 push、不開 PR、不 merge 到環境分支、不部署、不 stash 或清除工作樹。
 * 系統邊界:`runExternal(command, args)` 是 gh(可回傳 Promise);`fetchRemote({ root, remote, repository, refspec })`
 * 是網路 fetch(remote 的設定與實際 fetch 身分已先核對)。其餘 Git 操作一律直接執行。
 */
import { singleLine } from "../project-settings/single-line.mjs";
import { parseArguments } from "./args.mjs";
import { contribute } from "./contribute.mjs";
import { BaseSyncError } from "./errors.mjs";
import { runExternalCommand } from "./external.mjs";
import { fetchFromRemote } from "./git.mjs";
import { inspect } from "./inspect.mjs";
import { upgrade } from "./upgrade.mjs";

const COMMANDS = { inspect, upgrade, contribute };

export async function runBaseSync(
  argv,
  { runExternal = runExternalCommand, fetchRemote = fetchFromRemote } = {},
) {
  try {
    const { command, options } = parseArguments(argv);
    const report = await COMMANDS[command](options, {
      runExternal,
      fetchRemote,
    });
    return {
      exitCode: 0,
      stdout: `${JSON.stringify(report, null, 2)}\n`,
      stderr: "",
    };
  } catch (error) {
    // 未預期的錯誤不印原訊息:可能帶路徑以外的子行程輸出
    const message =
      error instanceof BaseSyncError ? error.message : "未預期的錯誤";
    return {
      exitCode: 1,
      stdout: "",
      stderr: `base-sync: ${singleLine(message)}\n`,
    };
  }
}
