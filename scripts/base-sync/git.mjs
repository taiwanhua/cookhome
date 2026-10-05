/**
 * Git 執行器:固定執行檔 + 參數陣列,不經 shell。失敗訊息只帶子命令名稱,不回印 stderr
 * (fetch 的錯誤可能含遠端 URL)。關掉互動式認證提示,避免等待輸入。
 */
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";

import { fail } from "./errors.mjs";

export const FULL_SHA = /^[0-9a-f]{40}$/;

export function runGit(cwd, args, { input, env } = {}) {
  const result = spawnSync("git", args, {
    cwd,
    input,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...env },
  });
  if (result.error) fail("無法執行 git");
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

/**
 * 網路 fetch 的系統邊界:以已核對身分的 remote 名稱 fetch(`repository` 是核對後的 owner/repo)。
 * 測試以同簽名的函式替換成真 Git fetch 夾具的本機 bare repo;正式執行不接受本機來源。
 */
export function fetchFromRemote({ root, remote, refspec }) {
  return runGit(root, [
    "fetch",
    "--no-tags",
    "--no-write-fetch-head",
    remote,
    refspec,
  ]);
}

/** 必須成功的 git 指令;回傳去掉尾端換行的 stdout。 */
export function git(cwd, args, options) {
  const result = runGit(cwd, args, options);
  if (result.status !== 0) fail(`git ${args[0]} 失敗`);
  return result.stdout.replace(/\n$/, "");
}

/** 以結束碼回答是非題的 git 指令(is-ancestor、cat-file -e 等)。 */
export const gitSucceeds = (cwd, args) => runGit(cwd, args).status === 0;

export const commitExists = (cwd, sha) =>
  gitSucceeds(cwd, ["cat-file", "-e", `${sha}^{commit}`]);

export const isAncestor = (cwd, ancestor, descendant) =>
  gitSucceeds(cwd, ["merge-base", "--is-ancestor", ancestor, descendant]);

/** ref 不存在時回 null。 */
export function resolveRef(cwd, ref) {
  const result = runGit(cwd, ["rev-parse", "--verify", "--quiet", ref]);
  return result.status === 0 ? result.stdout.trim() : null;
}

/** 取某 config 鍵的全部值(沒有就是空陣列)。 */
export function configValues(cwd, key) {
  const result = runGit(cwd, ["config", "--get-all", key]);
  if (result.status === 1) return [];
  if (result.status !== 0) fail("git config 讀取失敗");
  return result.stdout.split("\n").filter((line) => line !== "");
}

/** 比對路徑時先展開 symlink 與大小寫差異(Windows 的 8.3 短名、/private/var 等)。 */
export function canonicalPath(target) {
  try {
    return path.normalize(realpathSync.native(target));
  } catch {
    return path.normalize(path.resolve(target));
  }
}

/** 確認是 repo 根目錄且是完整歷史;回傳正規化的根路徑。 */
export function requireRepositoryRoot(dir, label) {
  const top = runGit(dir, ["rev-parse", "--show-toplevel"]);
  if (top.status !== 0) fail(`${label} 不是 Git repo`);
  const root = canonicalPath(top.stdout.trim());
  if (root !== canonicalPath(dir)) fail(`${label} 必須是 repo 根目錄`);
  if (git(root, ["rev-parse", "--is-shallow-repository"]) !== "false") {
    fail(`${label} 是淺層 clone,缺少共同祖先所需的完整歷史`);
  }
  return root;
}

/** `git diff --name-status -z --no-renames from to` → [{ path, status }],依路徑排序。 */
export function diffFiles(cwd, from, to) {
  const out = git(cwd, [
    "diff",
    "--name-status",
    "-z",
    "--no-renames",
    from,
    to,
    "--",
  ]);
  const parts = out.split("\0").filter((part) => part !== "");
  const files = [];
  for (let index = 0; index + 1 < parts.length; index += 2) {
    files.push({ path: parts[index + 1], status: parts[index] });
  }
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** 本次 git worktree list:路徑 → 分支(完整 ref 或 null)。 */
export function listWorktrees(cwd) {
  const out = git(cwd, ["worktree", "list", "--porcelain", "-z"]);
  const entries = [];
  let current = null;
  for (const field of out.split("\0")) {
    if (field === "") {
      if (current) entries.push(current);
      current = null;
      continue;
    }
    if (field.startsWith("worktree ")) {
      current = { path: canonicalPath(field.slice(9)), branch: null };
    } else if (field.startsWith("branch ") && current) {
      current.branch = field.slice(7);
    }
  }
  if (current) entries.push(current);
  return entries;
}
