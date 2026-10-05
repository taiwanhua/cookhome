/* eslint-disable sonarjs/no-os-command-from-path -- 以 git 核對執行中的 checkout:git 的安裝位置因機器而異,只能靠 PATH;不經 shell、參數固定、失敗就回 null;到期條件:無 */
/**
 * status JSON 的 `sourceCommit`(`docs/deployment.md`「設定與資料更新」、「發布前環境與資料核對」):
 * 執行中這個 checkout 的完整 HEAD。
 *
 * 這次讀到的來源除了 registry、`seeds/`、`migrations/`,還有它們 import 的同 checkout 程式(source-root 底下的
 * 其他檔、`packages/domain` 這類共用套件),所以保守地要求(不追 import 關係):
 *
 * - registry 與 source-root 都屬於同一個 checkout(不在外部、不在巢狀的另一個 checkout),registry 有被追蹤
 * - 整個 checkout 沒有任何已追蹤檔的改動(含已暫存),也沒有未追蹤的檔(與來源無關的暫存檔也算,寧可回 null)
 * - `seeds/`、`migrations/` 與 registry 沒有被忽略的檔(其他被忽略的建置產物、`node_modules` 不算)
 *
 * 任何一項證明不了(或沒有 git)就回 null,不拿 `GITHUB_SHA` 猜。
 */
import { execFileSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import path from "node:path";

const FULL_SHA = /^[0-9a-f]{40}$/;

/** 要核對的執行位置與這次讀到的來源。 */
export interface SourceProvenance {
  /** 執行中的程式所在目錄(屬於哪個 checkout 由 git 判斷)。 */
  checkoutRoot: string;
  /** `seeds/` 與 `migrations/` 所在的目錄。 */
  sourceRoot: string;
  registryPath: string;
}

function git(cwd: string, args: readonly string[]): string {
  return execFileSync("git", ["--literal-pathspecs", "-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function toplevelOf(directory: string): string {
  return realpathSync.native(git(directory, ["rev-parse", "--show-toplevel"]));
}

/** 來源屬於 `toplevel` 這個 checkout 時回它的相對路徑(git pathspec 寫法),否則回 null。 */
function pathspecOf(toplevel: string, source: string): string | null {
  const resolved = realpathSync.native(source);
  const directory = statSync(resolved).isDirectory()
    ? resolved
    : path.dirname(resolved);
  // 巢狀的另一個 checkout(例如 worktree)路徑上在裡面,但不屬於它
  if (toplevelOf(directory) !== toplevel) {
    return null;
  }
  const relative = path.relative(toplevel, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return relative === "" ? "." : relative.split(path.sep).join("/");
}

/** 證明得了來源就回完整 HEAD,否則 null(唯讀;不丟錯)。 */
export function resolveSourceCommit({
  checkoutRoot,
  sourceRoot,
  registryPath,
}: SourceProvenance): string | null {
  try {
    const toplevel = toplevelOf(checkoutRoot);
    const head = git(toplevel, ["rev-parse", "--verify", "HEAD"]);
    const registry = pathspecOf(toplevel, registryPath);
    const root = pathspecOf(toplevel, sourceRoot);
    const declared = [
      path.join(sourceRoot, "seeds"),
      path.join(sourceRoot, "migrations"),
    ].map((source) => pathspecOf(toplevel, source));
    if (
      !FULL_SHA.test(head) ||
      registry === null ||
      root === null ||
      declared.includes(null)
    ) {
      return null;
    }
    // registry 檔本身要被追蹤(未追蹤時丟錯 → null)
    git(toplevel, ["ls-files", "--error-unmatch", "--", registry]);
    const status = (args: readonly string[]) =>
      git(toplevel, ["status", "--porcelain", ...args]);
    const dirty = [
      // 整個 checkout:已追蹤的改動與未追蹤的檔(被忽略的不列)
      status(["--untracked-files=all"]),
      status([
        "--untracked-files=all",
        "--ignored",
        "--",
        registry,
        ...(declared as string[]),
      ]),
    ];
    return dirty.every((output) => output === "") ? head : null;
  } catch {
    return null;
  }
}
