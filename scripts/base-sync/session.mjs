/**
 * 本工具建立的 feature 分支與工作樹。可重建的執行資訊存在該分支的本機 Git config(`branch.<name>.basesync-*`),
 * 分支刪除時 Git 會一併移除;它不是版本正本,重跑時仍以實際 Git 狀態核對。
 */
import { existsSync, statSync } from "node:fs";
import path from "node:path";

import { fail } from "./errors.mjs";
import {
  canonicalPath,
  configValues,
  git,
  gitSucceeds,
  listWorktrees,
} from "./git.mjs";

const PREFIX = "basesync-";

export function requireDirectory(dir, label) {
  if (
    typeof dir !== "string" ||
    !existsSync(dir) ||
    !statSync(dir).isDirectory()
  ) {
    fail(`${label} 必須是已存在的目錄`);
  }
  return path.resolve(dir);
}

/** 分支名稱固定在 codex/ 底下,不可能是 main / dev / staging。 */
export function branchName(root, name) {
  const branch = `codex/${name}`;
  if (!gitSucceeds(root, ["check-ref-format", "--branch", branch])) {
    fail("無法組出合法的分支名稱");
  }
  return branch;
}

export function writeSession(root, branch, values) {
  for (const [key, value] of Object.entries(values)) {
    git(root, ["config", "--local", `branch.${branch}.${PREFIX}${key}`, value]);
  }
}

export function readSession(root, branch, keys) {
  return Object.fromEntries(
    keys.map((key) => {
      const values = configValues(root, `branch.${branch}.${PREFIX}${key}`);
      return [key, values.length === 1 ? values[0] : null];
    }),
  );
}

/** 依 Git 的 worktree 清單找出分支所在的工作樹;路徑必須與記錄一致。 */
export function sessionWorktree(root, branch, recorded) {
  const entry = listWorktrees(root).find(
    (worktree) => worktree.branch === `refs/heads/${branch}`,
  );
  if (!entry || recorded === null) {
    fail(`分支 ${branch} 沒有對應的工作樹;請人工檢查後依 deployment 重建`);
  }
  if (entry.path !== canonicalPath(recorded) || !existsSync(recorded)) {
    fail(`分支 ${branch} 的工作樹位置與記錄不符;不自動搬移`);
  }
  return recorded;
}

/** 新工作樹的位置不可已被占用(不覆蓋外部目錄或其他工作樹)。 */
export function requireFreeWorktreePath(target) {
  if (existsSync(target)) fail(`工作樹路徑已存在:${target}`);
}

/** 工作樹內其他進行中的操作(rebase / cherry-pick / revert)一律不接手。 */
export function requireNoOtherOperation(worktree) {
  for (const ref of ["REBASE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD"]) {
    if (gitSucceeds(worktree, ["rev-parse", "--verify", "--quiet", ref])) {
      fail(`工作樹有進行中的 ${ref};不接手`);
    }
  }
}

/** 未解決衝突的路徑(排序)。 */
export function conflictedPaths(worktree) {
  return git(worktree, ["diff", "--name-only", "-z", "--diff-filter=U"])
    .split("\0")
    .filter((file) => file !== "")
    .sort();
}

/** 以 `gh pr list --repo` 找同 head 的 open PR;沒有就是 null。 */
export async function findPullRequest(runExternal, repository, branch) {
  const result = await runExternal("gh", [
    "pr",
    "list",
    "--repo",
    repository,
    "--head",
    branch,
    "--state",
    "open",
    "--json",
    "number,url,isDraft",
  ]);
  if (result.status !== 0) fail(`無法查詢 ${repository} 的 PR`);
  let pulls;
  try {
    pulls = JSON.parse(result.stdout);
  } catch {
    fail(`無法解析 ${repository} 的 PR 查詢結果`);
  }
  if (!Array.isArray(pulls)) fail(`無法解析 ${repository} 的 PR 查詢結果`);
  const pull = pulls.find(
    (item) =>
      Number.isInteger(item?.number) &&
      typeof item.url === "string" &&
      item.url.startsWith(`https://github.com/${repository}/pull/`),
  );
  return pull
    ? { number: pull.number, url: pull.url, isDraft: pull.isDraft === true }
    : null;
}
