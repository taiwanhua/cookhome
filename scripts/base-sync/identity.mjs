/**
 * repo 身分:只接受 GitHub 的 HTTPS / SSH URL,正規化成 owner/repo。
 * remote 的原始設定值(`git config remote.<name>.url`)與實際 fetch 位址(insteadOf 改寫後)必須是同一個 GitHub repo;
 * 帶認證資訊、未知 host、port、query、本機路徑的 URL 拒絕,錯誤訊息不回印 URL。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  ProjectSettingsError,
  resolveGithubConfig,
} from "../project-settings/config.mjs";
import { fail } from "./errors.mjs";
import { FULL_SHA, configValues, runGit } from "./git.mjs";

const GITHUB_FILE = "deploy/project/github.json";

const NAME = "[A-Za-z0-9_.-]+";
const REPOSITORY = new RegExp(`^${NAME}/${NAME}$`);
const SCP = new RegExp(`^git@github\\.com:(${NAME}/${NAME})$`);

function stripGitSuffix(repository) {
  const trimmed = repository.endsWith(".git")
    ? repository.slice(0, -4)
    : repository;
  return REPOSITORY.test(trimmed) &&
    !trimmed.split("/").some((part) => part === "" || /^\.+$/.test(part))
    ? trimmed
    : null;
}

/** GitHub URL → owner/repo;無法證明是 GitHub 身分時回 null。 */
export function parseGithubRepository(url) {
  if (typeof url !== "string" || /[\s\u0000-\u001f\u007f]/.test(url)) {
    return null;
  }
  const scp = SCP.exec(url);
  if (scp) return stripGitSuffix(scp[1]);
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname !== "github.com" || parsed.search || parsed.hash) {
    return null;
  }
  if (parsed.protocol === "https:") {
    if (parsed.username || parsed.password || parsed.port) return null;
  } else if (parsed.protocol === "ssh:") {
    if (parsed.username !== "git" || parsed.password) return null;
    if (parsed.port && parsed.port !== "22") return null;
  } else {
    return null;
  }
  const pathname = parsed.pathname.replace(/^\//, "").replace(/\/$/, "");
  return stripGitSuffix(pathname);
}

/**
 * 原始設定的 URL 與 Git 實際使用的 fetch URL(套用 insteadOf 後)→ 共同的 owner/repo。
 * 兩者都必須剛好一個、都是可接受的 GitHub 身分且指向同一個 repo(允許同一 repo 的 HTTPS ↔ SSH 改寫);
 * 否則回傳拒絕原因。本機路徑、別的 repo、其他 host 或帶認證資訊的改寫一律拒絕。
 */
export function remoteIdentity(rawUrls, effectiveUrls) {
  if (rawUrls.length !== 1 || effectiveUrls.length !== 1) {
    return { repository: null, reason: "必須剛好設定一個 URL" };
  }
  const configured = parseGithubRepository(rawUrls[0]);
  if (configured === null) {
    return {
      repository: null,
      reason: "不是可接受的 GitHub HTTPS / SSH 身分(不得含認證資訊)",
    };
  }
  if (parseGithubRepository(effectiveUrls[0]) !== configured) {
    return {
      repository: null,
      reason: "實際 fetch 位址被改寫到其他 repo 或非 GitHub 來源(insteadOf)",
    };
  }
  return { repository: configured, reason: null };
}

/** `git remote get-url --all`:套用 insteadOf 後實際用來 fetch 的 URL。 */
export function effectiveFetchUrls(root, remote) {
  const result = runGit(root, ["remote", "get-url", "--all", remote]);
  if (result.status !== 0) return [];
  return result.stdout.split("\n").filter((line) => line !== "");
}

/** 核對某 remote 的設定與實際 fetch 身分;任何網路 fetch 之前呼叫。錯誤訊息不回印 URL。 */
export function remoteRepository(root, remote, label) {
  const { repository, reason } = remoteIdentity(
    configValues(root, `remote.${remote}.url`),
    effectiveFetchUrls(root, remote),
  );
  if (repository === null) fail(`${label} 的 ${remote} ${reason}`);
  return repository;
}

/** 某個 commit 裡的檔案內容;不存在時回 null。只讀 Git 物件,不看工作樹。 */
function committedText(root, ref, file) {
  const result = runGit(root, ["show", `${ref}:${file}`]);
  return result.status === 0 ? result.stdout : null;
}

/**
 * origin 與 `ref` 這個 commit 的 deploy/project/github.json(expectedRepository)核對。
 * 沿用既有讀取器的驗證:把已提交的檔案放進暫存目錄再交給 resolveGithubConfig,不讀工作樹裡可能未提交的版本。
 */
export function verifiedOrigin(root, label, ref) {
  const repository = remoteRepository(root, "origin", label);
  const text = committedText(root, ref, GITHUB_FILE);
  if (text === null) fail(`${label} 在 ${ref} 沒有 ${GITHUB_FILE}`);
  const dir = mkdtempSync(path.join(tmpdir(), "base-sync-identity-"));
  try {
    mkdirSync(path.join(dir, path.dirname(GITHUB_FILE)), { recursive: true });
    writeFileSync(path.join(dir, GITHUB_FILE), text);
    resolveGithubConfig({ rootDir: dir, repository });
  } catch (error) {
    if (error instanceof ProjectSettingsError) {
      fail(`${label} 的 origin 身分核對失敗:${error.message}`);
    }
    throw error;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return repository;
}

/** `ref` 這個 commit 的根 package.json 的 wowgoBase(採用版本記錄)。 */
export function readAdoption(root, label, ref) {
  let manifest;
  try {
    manifest = JSON.parse(committedText(root, ref, "package.json"));
  } catch {
    fail(`${label} 在 ${ref} 的 package.json 讀不到或不是 JSON`);
  }
  const record = manifest?.wowgoBase;
  if (typeof record !== "object" || record === null) {
    fail(`${label} 的 package.json 缺少 wowgoBase`);
  }
  const repository = parseGithubRepository(record.repository);
  if (repository === null) {
    fail(`${label} 的 wowgoBase.repository 不是可接受的 GitHub 身分`);
  }
  if (typeof record.tag !== "string" || !isTagName(record.tag)) {
    fail(`${label} 的 wowgoBase.tag 格式不符`);
  }
  if (typeof record.commit !== "string" || !FULL_SHA.test(record.commit)) {
    fail(`${label} 的 wowgoBase.commit 必須是 40 位 commit SHA`);
  }
  return { repository, tag: record.tag, commit: record.commit };
}

/** 版本名稱:不得以 - 開頭(避免被當成選項),只允許 ref 安全字元。 */
export function isTagName(value) {
  return (
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(value) &&
    !value.includes("..") &&
    !value.endsWith(".") &&
    !value.endsWith(".lock")
  );
}

/**
 * 引用專案在 `ref`(已提交的 commit)的身分與採用版本。工作樹裡未提交或過期的值不採用,也不修改。
 * `requireUpstream` 時另核對 upstream 指向 wowgoBase.repository。
 */
export function loadProject(root, { ref, requireUpstream }) {
  const label = path.basename(root);
  const repository = verifiedOrigin(root, label, ref);
  const adopted = readAdoption(root, label, ref);
  if (requireUpstream) {
    const upstream = remoteRepository(root, "upstream", label);
    if (upstream !== adopted.repository) {
      fail(
        `${label} 的 upstream 是 ${upstream},與 wowgoBase.repository(${adopted.repository})不符`,
      );
    }
  }
  return { root, label, repository, adopted };
}
