#!/usr/bin/env node
/**
 * 專案設定讀取器 CLI(deploy / reset-db / project-status / ci 四支 workflow 共用)。固定兩種入口:
 *
 *   node scripts/project-settings/read-config.mjs --scope cloud --environment <dev|staging|production> --repository <owner/repo>
 *   node scripts/project-settings/read-config.mjs --scope github --repository <owner/repo>
 *
 * 設定檔相對於目前工作目錄(repo 根)的 `deploy/project/` 讀取。
 * 協定:成功時 stdout 只有一行 JSON 物件、退出碼 0;失敗時 stdout 無輸出、stderr 一行說明、退出碼非零。
 * 輸出只含非機密設定與 Secret 名稱;本程式不讀任何 token 或 Secret 值。
 */
import {
  ProjectSettingsError,
  resolveCloudConfig,
  resolveGithubConfig,
} from "./config.mjs";
import { singleLine } from "./single-line.mjs";

const OPTIONS = ["--scope", "--environment", "--repository"];
const SCOPE_OPTIONS = {
  cloud: ["--scope", "--environment", "--repository"],
  github: ["--scope", "--repository"],
};

/** 錯誤訊息只用固定文字與白名單內的參數名,不回印 argv 的原值(可能帶換行或 workflow 指令)。 */
function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!OPTIONS.includes(name)) {
      throw new ProjectSettingsError(
        `未知的參數(只接受 ${OPTIONS.join(" / ")})`,
      );
    }
    if (Object.hasOwn(values, name)) {
      throw new ProjectSettingsError(`參數 ${name} 重複`);
    }
    if (value === undefined || value.startsWith("--")) {
      throw new ProjectSettingsError(`參數 ${name} 缺少值`);
    }
    values[name] = value;
  }
  const scope = values["--scope"];
  if (!Object.hasOwn(SCOPE_OPTIONS, scope ?? "")) {
    throw new ProjectSettingsError("--scope 必須是 cloud 或 github");
  }
  for (const name of Object.keys(values)) {
    if (!SCOPE_OPTIONS[scope].includes(name)) {
      throw new ProjectSettingsError(`--scope ${scope} 不接受 ${name}`);
    }
  }
  for (const name of SCOPE_OPTIONS[scope]) {
    if (!Object.hasOwn(values, name)) {
      throw new ProjectSettingsError(`--scope ${scope} 需要 ${name}`);
    }
  }
  return {
    scope,
    environment: values["--environment"],
    repository: values["--repository"],
  };
}

try {
  const { scope, environment, repository } = parseArguments(
    process.argv.slice(2),
  );
  const rootDir = process.cwd();
  const resolved =
    scope === "cloud"
      ? resolveCloudConfig({ rootDir, environment, repository })
      : resolveGithubConfig({ rootDir, repository });
  process.stdout.write(`${JSON.stringify(resolved)}\n`);
} catch (error) {
  // 未預期的錯誤不印原訊息:它可能帶設定值或輸入的原值
  const message =
    error instanceof ProjectSettingsError ? error.message : "未預期的錯誤";
  process.stderr.write(`project-settings: ${singleLine(message)}\n`);
  process.exitCode = 1;
}
