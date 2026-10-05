/**
 * 底座正式版本的核對(SOP 正本:docs/deployment.md「底座首次接軌與版本升級」)。
 * - 正式 GitHub Release:非 draft、非 prerelease;gh 一律明示 `--repo`。
 * - tag 以明確 refspec 從 upstream 取到暫存 ref,核對是 annotated tag 且名稱相符,
 *   再存到獨立的 `refs/base/releases/<tag>`,不碰專案自己的 refs/tags。
 * - 已存過的同名版本若改指不同 tag object,一律拒絕,不覆寫既有 ref。
 */
import path from "node:path";

import { fail } from "./errors.mjs";
import { git, isAncestor, resolveRef, runGit } from "./git.mjs";
import { remoteRepository } from "./identity.mjs";

const RELEASE_PREFIX = "refs/base/releases/";
const INCOMING_PREFIX = "refs/base/incoming/";
const ZERO_SHA = "0".repeat(40);

export async function checkRelease(runExternal, repository, tag) {
  const result = await runExternal("gh", [
    "release",
    "view",
    tag,
    "--repo",
    repository,
    "--json",
    "tagName,isDraft,isPrerelease,url",
  ]);
  if (result.status !== 0) {
    fail(`無法確認 ${repository} ${tag} 的正式 GitHub Release`);
  }
  let release;
  try {
    release = JSON.parse(result.stdout);
  } catch {
    fail(`無法解析 ${repository} ${tag} 的 GitHub Release 回應`);
  }
  if (
    release?.tagName !== tag ||
    release.isDraft !== false ||
    release.isPrerelease !== false
  ) {
    fail(
      `${repository} ${tag} 不是正式 GitHub Release(不可為 draft 或 prerelease)`,
    );
  }
  const url =
    typeof release.url === "string" &&
    release.url.startsWith(`https://github.com/${repository}/releases/`)
      ? release.url
      : null;
  return { url };
}

/**
 * 從 upstream 取 tag 並核對;回傳 `{ tagObject, commit }`,尚未存入正式 ref。
 * fetch 前再核對 upstream 的設定與實際 fetch 位址都是 `repository`(與 Release 查詢的 repo 相同)。
 */
export function fetchReleaseTag(root, tag, { fetchRemote, repository }) {
  const upstream = remoteRepository(root, "upstream", path.basename(root));
  if (upstream !== repository) {
    fail(`upstream(${upstream})不是 ${repository};拒絕取得 tag ${tag}`);
  }
  const incoming = `${INCOMING_PREFIX}${tag}`;
  const fetched = fetchRemote({
    root,
    remote: "upstream",
    repository,
    refspec: `+refs/tags/${tag}:${incoming}`,
  });
  try {
    if (fetched.status !== 0) fail(`無法從 upstream 取得 tag ${tag}`);
    const tagObject = git(root, ["rev-parse", "--verify", incoming]);
    if (git(root, ["cat-file", "-t", tagObject]) !== "tag") {
      fail(`${tag} 不是 annotated tag;正式版本須以 annotated tag 發布`);
    }
    const header = git(root, ["cat-file", "tag", tagObject]).split("\n");
    if (!header.includes(`tag ${tag}`)) fail(`${tag} 的 tag object 名稱不符`);
    const commit = git(root, [
      "rev-parse",
      "--verify",
      `${tagObject}^{commit}`,
    ]);
    const stored = resolveRef(root, `${RELEASE_PREFIX}${tag}`);
    if (stored !== null && stored !== tagObject) {
      fail(
        `底座 ${tag} 已改指不同內容(先前 ${stored},現在 ${tagObject});同名版本不得重發,拒絕覆寫 ${RELEASE_PREFIX}${tag}`,
      );
    }
    return { tagObject, commit };
  } finally {
    runGit(root, ["update-ref", "-d", incoming]);
  }
}

/** 第一次取得時建立 `refs/base/releases/<tag>`(只建立、不覆寫)。 */
export function storeReleaseTag(root, tag, tagObject) {
  const ref = `${RELEASE_PREFIX}${tag}`;
  if (resolveRef(root, ref) === tagObject) return;
  git(root, ["update-ref", ref, tagObject, ZERO_SHA]);
}

/**
 * 已採用版本:wowgoBase 的 tag 必須解析到記錄的 commit,且該 commit 是 origin/main 的祖先。
 * 尚未存過的採用版本 tag 依同一方式取得並存入。
 */
export function verifyAdoption(project, mainCommit, fetchRemote) {
  const { root, label, adopted } = project;
  const stored = resolveRef(root, `${RELEASE_PREFIX}${adopted.tag}`);
  const release =
    stored === null
      ? fetchReleaseTag(root, adopted.tag, {
          fetchRemote,
          repository: adopted.repository,
        })
      : {
          tagObject: stored,
          commit: git(root, ["rev-parse", "--verify", `${stored}^{commit}`]),
        };
  if (release.commit !== adopted.commit) {
    fail(
      `${label} 的 wowgoBase.commit 與底座 ${adopted.tag} 的 commit 不符(${release.commit})`,
    );
  }
  if (!isAncestor(root, adopted.commit, mainCommit)) {
    fail(
      `${label} 的 wowgoBase.commit 不是 origin/main 的祖先;採用記錄與實際 ancestry 不符`,
    );
  }
  storeReleaseTag(root, adopted.tag, release.tagObject);
}
