/**
 * `upgrade`:逐案核對正式來源,從 origin/main 建隔離工作樹與 feature 分支,正常三方 merge(--no-ff --no-commit),
 * 保留未提交結果給 agent 整合。不 push、不開 PR、不 reset / rebase / stash。
 * 重跑時以記錄的 repo / origin-main / tag object / commit 與實際 Git 狀態核對,符合才回報既有狀態。
 */
import path from "node:path";

import { classifyFiles } from "./classify.mjs";
import { fail } from "./errors.mjs";
import {
  diffFiles,
  git,
  isAncestor,
  requireRepositoryRoot,
  resolveRef,
  runGit,
} from "./git.mjs";
import {
  isTagName,
  loadProject,
  remoteRepository,
  verifiedOrigin,
} from "./identity.mjs";
import {
  checkRelease,
  fetchReleaseTag,
  storeReleaseTag,
  verifyAdoption,
} from "./release.mjs";
import {
  branchName,
  conflictedPaths,
  findPullRequest,
  readSession,
  requireDirectory,
  requireFreeWorktreePath,
  requireNoOtherOperation,
  sessionWorktree,
  writeSession,
} from "./session.mjs";

const SESSION_KEYS = [
  "kind",
  "repository",
  "main",
  "tagobject",
  "target",
  "worktree",
];

/** 取得 origin 最新的 main(只更新 remote-tracking ref);fetch 前核對 origin 的設定與實際 fetch 身分。 */
export function fetchOriginMain(root, label, fetchRemote) {
  const repository = remoteRepository(root, "origin", label);
  const fetched = fetchRemote({
    root,
    remote: "origin",
    repository,
    refspec: "+refs/heads/main:refs/remotes/origin/main",
  });
  if (fetched.status !== 0) fail(`無法從 ${label} 的 origin 取得 main`);
  return git(root, [
    "rev-parse",
    "--verify",
    "refs/remotes/origin/main^{commit}",
  ]);
}

function upgradeFiles(root, mainCommit, target, conflicts) {
  const base = git(root, ["merge-base", mainCommit, target]);
  return classifyFiles(diffFiles(root, base, target)).map((file) => ({
    ...file,
    isConflicted: conflicts.includes(file.path),
  }));
}

/** 已提交的升級:HEAD 的 first-parent 鏈上必須有一個 parents 恰為 [main, target] 的 merge。 */
function hasNormalMerge(worktree, mainCommit, target) {
  const lines = git(worktree, [
    "rev-list",
    "--first-parent",
    "--parents",
    `${mainCommit}..HEAD`,
  ]).split("\n");
  return lines.some((line) => {
    const [, ...parents] = line.split(" ");
    return (
      parents.length === 2 && parents[0] === mainCommit && parents[1] === target
    );
  });
}

function verifyResumable(context, branch) {
  const { project, release, mainCommit } = context;
  const session = readSession(project.root, branch, SESSION_KEYS);
  if (
    session.kind !== "upgrade" ||
    session.repository !== project.repository ||
    session.tagobject !== release.tagObject ||
    session.target !== release.commit
  ) {
    fail(
      `分支 ${branch} 已存在但不是同一次升級(repo / tag / commit 不符);不覆蓋`,
    );
  }
  if (session.main !== mainCommit) {
    fail(
      `${project.label} 的 origin/main 已從 ${session.main} 前進到 ${mainCommit};依 deployment 從新 main 重建升級分支(本工具不 reset / rebase 既有分支)`,
    );
  }
  const worktree = sessionWorktree(project.root, branch, session.worktree);
  requireNoOtherOperation(worktree);
  const head = git(worktree, ["rev-parse", "--verify", "HEAD"]);
  const mergeHead = resolveRef(worktree, "MERGE_HEAD^{commit}");
  const isPendingMerge = mergeHead === release.commit && head === mainCommit;
  const isCommittedMerge =
    mergeHead === null && hasNormalMerge(worktree, mainCommit, release.commit);
  if (!isPendingMerge && !isCommittedMerge) {
    fail(`工作樹 ${worktree} 的 Git 狀態不是這次升級的正常 merge;不接手`);
  }
  return worktree;
}

async function prepareProject(context, runExternal) {
  const { project, release, mainCommit, tag, worktreeRoot } = context;
  const repoName = project.repository.split("/")[1];
  const branch = branchName(project.root, `base-upgrade-${tag}`);
  const exists = resolveRef(project.root, `refs/heads/${branch}`) !== null;
  let worktree;
  if (exists) {
    worktree = verifyResumable(context, branch);
  } else {
    worktree = path.join(worktreeRoot, `${repoName}-base-upgrade-${tag}`);
    requireFreeWorktreePath(worktree);
    git(project.root, [
      "worktree",
      "add",
      "--no-track",
      "-b",
      branch,
      worktree,
      mainCommit,
    ]);
    writeSession(project.root, branch, {
      kind: "upgrade",
      repository: project.repository,
      main: mainCommit,
      tagobject: release.tagObject,
      target: release.commit,
      worktree,
    });
    runGit(worktree, [
      "merge",
      "--no-ff",
      "--no-commit",
      "-m",
      `Merge ${project.adopted.repository} ${tag}`,
      release.commit,
    ]);
    if (resolveRef(worktree, "MERGE_HEAD^{commit}") !== release.commit) {
      fail(`工作樹 ${worktree} 的 merge 沒有開始;請人工檢查`);
    }
  }
  const conflicts = conflictedPaths(worktree);
  return {
    repository: project.repository,
    root: project.root,
    state: exists ? "existing" : "prepared",
    branch,
    worktree,
    mainCommit,
    adopted: project.adopted,
    conflicts,
    files: upgradeFiles(project.root, mainCommit, release.commit, conflicts),
    pullRequest: await findPullRequest(runExternal, project.repository, branch),
  };
}

export async function upgrade(options, { runExternal, fetchRemote }) {
  const { tag } = options;
  if (!isTagName(tag)) fail("--tag 格式不符");
  const worktreeRoot = requireDirectory(
    options.worktreeRoot,
    "--worktree-root",
  );
  const roots = options.projects.map((dir) =>
    requireRepositoryRoot(dir, "--project"),
  );
  if (new Set(roots).size !== roots.length) fail("--project 重複");
  // 身分與採用版本以剛取得的 origin/main 為準(本機 checkout 可能較舊或有未提交改動,不採用也不修改)
  const loaded = roots.map((root) => {
    const label = path.basename(root);
    // fetch 之前先以本機已知的 origin/main(或 HEAD)核對身分,不向不明的 repo 取資料
    const knownRef =
      resolveRef(root, "refs/remotes/origin/main^{commit}") ?? "HEAD";
    verifiedOrigin(root, label, knownRef);
    const mainCommit = fetchOriginMain(root, label, fetchRemote);
    return {
      project: loadProject(root, { ref: mainCommit, requireUpstream: true }),
      mainCommit,
    };
  });
  const baseRepository = loaded[0].project.adopted.repository;
  if (
    loaded.some(({ project }) => project.adopted.repository !== baseRepository)
  ) {
    fail("各專案的 wowgoBase.repository 不同;請分批升級");
  }
  const releaseInfo = await checkRelease(runExternal, baseRepository, tag);

  // 先全部核對完,才建立任何分支或工作樹
  const contexts = loaded.map(({ project, mainCommit }) => {
    verifyAdoption(project, mainCommit, fetchRemote);
    const release = fetchReleaseTag(project.root, tag, {
      fetchRemote,
      repository: baseRepository,
    });
    if (!isAncestor(project.root, project.adopted.commit, release.commit)) {
      fail(
        `${tag} 不是 ${project.label} 已採用版本 ${project.adopted.tag} 之後的版本`,
      );
    }
    return { project, release, mainCommit, tag, worktreeRoot };
  });
  const [first] = contexts;
  if (
    contexts.some(
      ({ release }) =>
        release.tagObject !== first.release.tagObject ||
        release.commit !== first.release.commit,
    )
  ) {
    fail(`各專案取得的 ${tag} 內容不同;請先核對 upstream`);
  }

  const reports = [];
  for (const context of contexts) {
    storeReleaseTag(context.project.root, tag, context.release.tagObject);
    if (
      isAncestor(
        context.project.root,
        context.release.commit,
        context.mainCommit,
      )
    ) {
      reports.push({
        repository: context.project.repository,
        root: context.project.root,
        state: "current",
        mainCommit: context.mainCommit,
        adopted: context.project.adopted,
      });
      continue;
    }
    reports.push(await prepareProject(context, runExternal));
  }
  return {
    schemaVersion: 1,
    command: "upgrade",
    tag,
    base: {
      repository: baseRepository,
      tagObject: first.release.tagObject,
      commit: first.release.commit,
      releaseUrl: releaseInfo.url,
    },
    projects: reports,
  };
}
