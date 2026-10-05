/** preflight 用到的本機 Git 查詢(唯讀;固定執行檔 + 參數陣列,不經 shell)。 */
import { spawnSync } from "node:child_process";

export const FULL_SHA = /^[0-9a-f]{40}$/;

function runGit(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  if (result.error) return { status: null, stdout: "" };
  return { status: result.status, stdout: result.stdout };
}

/** 成功時回 stdout(去尾端換行),失敗回 null。 */
export function gitOutput(cwd, args) {
  const result = runGit(cwd, args);
  return result.status === 0 ? result.stdout.replace(/\n$/, "") : null;
}

export const isAncestor = (cwd, ancestor, descendant) =>
  runGit(cwd, ["merge-base", "--is-ancestor", ancestor, descendant]).status ===
  0;

/** 完整 SHA 是否為本機 commit;回傳該 SHA 或 null。 */
export function knownCommit(cwd, sha) {
  if (!FULL_SHA.test(sha ?? "")) return null;
  return gitOutput(cwd, [
    "rev-parse",
    "--verify",
    "--quiet",
    `${sha}^{commit}`,
  ]);
}

/**
 * 部署 tag 的短 SHA → 完整 commit。由本機 Git 唯一解析;歧義、不存在或不是 commit 都回 null。
 */
export function resolveAbbreviation(cwd, abbreviation) {
  if (!/^[0-9a-f]{7,40}$/.test(abbreviation)) return null;
  const full = gitOutput(cwd, [
    "rev-parse",
    "--verify",
    "--quiet",
    `${abbreviation}^{commit}`,
  ]);
  return full !== null && FULL_SHA.test(full) && full.startsWith(abbreviation)
    ? full
    : null;
}

/** base..target 的檔案差異 → [{ path, status }](依路徑排序)。 */
export function diffFiles(cwd, base, target) {
  const out = gitOutput(cwd, [
    "diff",
    "--name-status",
    "-z",
    "--no-renames",
    base,
    target,
    "--",
  ]);
  if (out === null) return null;
  const parts = out.split("\0").filter((part) => part !== "");
  const files = [];
  for (let index = 0; index + 1 < parts.length; index += 2) {
    files.push({ path: parts[index + 1], status: parts[index] });
  }
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** 基準到 target 的累積差異;基準無法比較時回 null。 */
export function cumulativeDiff(cwd, base, target, filter = () => true) {
  const files = diffFiles(cwd, base, target);
  if (files === null) return null;
  return {
    base,
    isAncestor: isAncestor(cwd, base, target),
    files: files.filter((file) => filter(file.path)),
  };
}

/** 目前 checkout:repo 根、HEAD、是否有未提交改動(含未追蹤檔)、origin 的原始 URL。 */
export function readCheckout(cwd) {
  const root = gitOutput(cwd, ["rev-parse", "--show-toplevel"]);
  if (root === null) return null;
  const status = gitOutput(root, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]);
  const origin = runGit(root, ["config", "--get-all", "remote.origin.url"]);
  // 套用 insteadOf 後實際的 fetch 位址;身分須與設定值相同
  const effective = runGit(root, ["remote", "get-url", "--all", "origin"]);
  return {
    root,
    head: gitOutput(root, ["rev-parse", "--verify", "HEAD"]),
    isDirty: status === null || status !== "",
    originUrls:
      origin.status === 0
        ? origin.stdout.split("\n").filter((line) => line !== "")
        : [],
    effectiveOriginUrls:
      effective.status === 0
        ? effective.stdout.split("\n").filter((line) => line !== "")
        : [],
  };
}
