/**
 * 發布前環境與累積資料差異報告(操作正本:docs/deployment.md「發布前環境與資料核對」;執行環境見 docs/agents/toolbox.md)。
 *
 *   runPreflight(["--environment", "<dev|staging|production>", "--target", "<full-sha>"], { cwd, env, runExternal })
 *
 * 前置條件(參數、checkout = target、無未提交改動、設定有效)不符時:exit 1、stdout 空、stderr 一行。
 * 報告生成即 exit 0;外部查詢失敗、unknown revision、DB 未核對都留在 `issues`。exit 0 不代表可以部署。
 * `runExternal(command, args, { cwd, env })` 是 gcloud 與 migrator 子行程的系統邊界;Git 直接在本機執行。
 */
import { remoteIdentity } from "../base-sync/identity.mjs";
import {
  ENVIRONMENTS,
  ProjectSettingsError,
  resolveCloudConfig,
} from "./config.mjs";
import { APPS, readApp } from "./preflight-cloud.mjs";
import { readDatabase } from "./preflight-database.mjs";
import { FULL_SHA, readCheckout } from "./preflight-git.mjs";
import { singleLine } from "./single-line.mjs";

const OPTIONS = ["--environment", "--target"];

const fail = (message) => {
  throw new ProjectSettingsError(message);
};

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!OPTIONS.includes(name)) {
      fail(`未知的參數(只接受 ${OPTIONS.join(" / ")})`);
    }
    if (Object.hasOwn(values, name)) fail(`參數 ${name} 重複`);
    if (value === undefined || value.startsWith("--")) {
      fail(`參數 ${name} 缺少值`);
    }
    values[name] = value;
  }
  const environment = values["--environment"];
  if (!ENVIRONMENTS.includes(environment)) {
    fail(`--environment 必須是 ${ENVIRONMENTS.join(" / ")}`);
  }
  const target = values["--target"];
  if (!FULL_SHA.test(target ?? "")) {
    fail("--target 必須是完整 40 位 commit SHA");
  }
  return { environment, target };
}

/** 目標必須就是這個乾淨的 checkout;回傳 repo 根與 origin 身分。 */
function verifyCheckout(cwd, target) {
  const checkout = readCheckout(cwd);
  if (checkout === null) fail("目前目錄不是 Git repo");
  if (checkout.head !== target) {
    fail(
      "--target 與目前 checkout 的 HEAD 不符;請在目標 commit 的 checkout 執行",
    );
  }
  if (checkout.isDirty) {
    fail("目前 checkout 有未提交的改動;不能以 target 名義執行其他來源");
  }
  // 與 base-sync 共用:設定值與實際 fetch 位址須是同一個 GitHub repo
  const { repository, reason } = remoteIdentity(
    checkout.originUrls,
    checkout.effectiveOriginUrls,
  );
  if (repository === null) fail(`origin ${reason}`);
  return { root: checkout.root, repository };
}

async function buildReport({ cwd, env, runExternal }, argv) {
  const { environment, target } = parseArguments(argv);
  const { root, repository } = verifyCheckout(cwd, target);
  const cloud = resolveCloudConfig({ rootDir: root, environment, repository });
  if (cloud.enabled === false) {
    fail("deploy/project/cloud.json 未啟用雲端,沒有可核對的環境");
  }
  const context = { root, env, runExternal, target, environment, cloud };
  const apps = [];
  const issues = [];
  for (const app of APPS) {
    const result = await readApp(app, context);
    apps.push(result.entry);
    issues.push(...result.issues);
  }
  const data = await readDatabase(context);
  issues.push(...data.issues);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    targetCommit: target,
    environment,
    repository,
    apps,
    database: data.database,
    dataChanges: data.dataChanges,
    issues,
  };
}

export async function runPreflight(argv, { cwd, env, runExternal }) {
  try {
    const report = await buildReport({ cwd, env, runExternal }, argv);
    return {
      exitCode: 0,
      stdout: `${JSON.stringify(report, null, 2)}\n`,
      stderr: "",
    };
  } catch (error) {
    // 未預期的錯誤不印原訊息:可能帶設定值或外部回應
    const message =
      error instanceof ProjectSettingsError ? error.message : "未預期的錯誤";
    return {
      exitCode: 1,
      stdout: "",
      stderr: `preflight: ${singleLine(message)}\n`,
    };
  }
}
