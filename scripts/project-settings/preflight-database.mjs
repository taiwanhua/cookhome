/**
 * DB 狀態:經受控子行程執行同一 checkout 的既有 `migrate:status --json`(格式見 docs/deployment.md「發布前環境與資料核對」),
 * 依固定 schema 驗證並只投影白名單欄位,不轉印子行程的其他輸出。
 * 連線字串取自既有 MONGODB_URI,沒有時讀設定指定的 Secret;只在記憶體與子行程環境傳遞,不輸出、不落檔。
 * 不以 API image 的 commit 當資料版本:資料差異的基準是 lastSuccessfulUpdate.releaseCommit。
 */
import { FULL_SHA, cumulativeDiff, knownCommit } from "./preflight-git.mjs";

/** 會改變資料的來源:migration、種子、受管定義的宣告與發布實作。 */
const DATA_SOURCES = [
  /^apps\/db-migrator\/migrations\//,
  /^apps\/db-migrator\/seeds\//,
  /^apps\/api\/src\/seed\//,
  /^packages\/domain\/src\/seed\//,
];
export const isDataSource = (file) =>
  DATA_SOURCES.some((pattern) => pattern.test(file));

const MIGRATION_ORIGINS = ["legacy", "base", "project"];
const CONTROL = /[\u0000-\u001f\u007f]/;

class InvalidStatus extends Error {}
const invalid = () => {
  throw new InvalidStatus();
};

const isObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const object = (value) => (isObject(value) ? value : invalid());
const array = (value) => (Array.isArray(value) ? value : invalid());
// 型別對齊 F2 的 UpdateStatusJson:必填字串須為非空字串、必填日期須為 ISO 字串;
// 只有 sourceCommit、releaseCommit、finishedAt 與 lastAttempt / lastSuccessfulUpdate / subsequentRuns / lock 可為 null
const text = (value) =>
  typeof value === "string" &&
  value !== "" &&
  value.length <= 500 &&
  !CONTROL.test(value)
    ? value
    : invalid();
const nullable = (check) => (value) => (value === null ? null : check(value));
const iso = (value) =>
  typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : invalid();
const sha = (value) => (FULL_SHA.test(value ?? "") ? value : invalid());
const origin = (value) =>
  MIGRATION_ORIGINS.includes(value) ? value : invalid();

/** 依欄位定義投影;缺欄位或型別不符即無效,多出的欄位直接丟棄。 */
const shape = (fields) => (value) => {
  const source = object(value);
  return Object.fromEntries(
    Object.entries(fields).map(([key, check]) => {
      if (!Object.hasOwn(source, key)) invalid();
      return [key, check(source[key])];
    }),
  );
};
const list = (check) => (value) => array(value).map(check);

const runSummary = shape({
  runId: text,
  operation: text,
  status: text,
  stage: text,
  releaseCommit: nullable(sha),
  startedAt: iso,
  finishedAt: nullable(iso),
});

const statusShape = shape({
  schemaVersion: (value) => (value === 1 ? 1 : invalid()),
  generatedAt: iso,
  sourceCommit: nullable(sha),
  lastAttempt: nullable(runSummary),
  lastSuccessfulUpdate: nullable(runSummary),
  subsequentRuns: nullable(list(runSummary)),
  migrations: shape({
    applied: list(shape({ fileName: text, origin, appliedAt: iso })),
    pending: list(shape({ fileName: text, origin })),
    orphaned: list(shape({ fileName: text, appliedAt: iso })),
    open: list(
      shape({
        fileName: text,
        status: text,
        runId: text,
        releaseCommit: nullable(sha),
      }),
    ),
  }),
  definitions: shape({
    open: list(
      shape({
        kind: text,
        key: text,
        revision: text,
        runId: text,
      }),
    ),
  }),
  lock: nullable(
    shape({
      owner: text,
      runId: text,
      operation: text,
      releaseCommit: nullable(sha),
      startedAt: iso,
    }),
  ),
});

/** 子行程 stdout → 投影後的 status;不符契約回 null。 */
export function parseStatus(stdout) {
  try {
    const status = statusShape(JSON.parse(stdout));
    if (
      status.lastSuccessfulUpdate === null &&
      status.subsequentRuns !== null
    ) {
      return null;
    }
    if (
      status.lastSuccessfulUpdate !== null &&
      status.subsequentRuns === null
    ) {
      return null;
    }
    return status;
  } catch {
    return null;
  }
}

/** 外部呼叫的結果分類:啟動不了、執行失敗或成功;不保留原始錯誤。 */
async function external(runExternal, command, args, options) {
  let result;
  try {
    result = await runExternal(command, args, options);
  } catch {
    return { failure: "launch-failed", stdout: "" };
  }
  if (result?.isLaunchFailure === true) {
    return { failure: "launch-failed", stdout: "" };
  }
  if (result?.status !== 0) return { failure: "query-failed", stdout: "" };
  return { failure: null, stdout: result.stdout };
}

/** 既有 MONGODB_URI 優先;沒有就讀設定指定的 Secret。回傳 `{ uri, failure }`。 */
async function connectionUri({ env, cloud, runExternal }) {
  const current = env.MONGODB_URI?.trim();
  if (current) return { uri: current, failure: null };
  const result = await external(runExternal, "gcloud", [
    "secrets",
    "versions",
    "access",
    "latest",
    `--secret=${cloud.mongodb_secret}`,
    `--project=${cloud.gcp_project_id}`,
  ]);
  if (result.failure === "launch-failed")
    return { uri: null, failure: "launch-failed" };
  const value = result.failure === null ? result.stdout.trim() : "";
  return value === ""
    ? { uri: null, failure: "secret-unavailable" }
    : { uri: value, failure: null };
}

const unavailable = (state, reason, status = null) => ({
  database: { state, status },
  dataChanges: null,
  issues: [{ code: "DATA_STATUS_UNAVAILABLE", scope: "database", reason }],
});

/** 讀 DB 狀態並算出資料來源差異;回傳 `{ database, dataChanges, issues }`。 */
export async function readDatabase(context) {
  const { root, env, runExternal, target } = context;
  const connection = await connectionUri(context);
  if (connection.uri === null) {
    return unavailable("unavailable", connection.failure);
  }
  // 邏輯命令 migrator:由外部邊界解析成同一 checkout 的 `run.ts --status --json`
  const result = await external(
    runExternal,
    "migrator",
    ["--status", "--json"],
    {
      cwd: root,
      env: { ...env, MONGODB_URI: connection.uri },
    },
  );
  if (result.failure !== null)
    return unavailable("unavailable", result.failure);
  const status = parseStatus(result.stdout);
  if (status === null) return unavailable("unavailable", "invalid-output");
  // 不同來源或無法證明來源的 status 不能代表本次 target
  if (status.sourceCommit !== target) {
    return unavailable("unverified", "source-unverified", status);
  }

  const issues = [];
  const isUnfinished =
    (status.subsequentRuns ?? []).length > 0 ||
    status.migrations.open.length > 0 ||
    status.lock !== null ||
    (status.lastAttempt !== null && status.lastAttempt.status !== "succeeded");
  if (isUnfinished) {
    issues.push({ code: "DATA_RUN_UNFINISHED", scope: "database" });
  }
  if (status.definitions.open.length > 0) {
    issues.push({ code: "DEFINITION_UPDATE_INCOMPLETE", scope: "database" });
  }
  if (status.migrations.orphaned.length > 0) {
    issues.push({
      code: "DATA_MIGRATIONS_ORPHANED",
      scope: "database",
      files: status.migrations.orphaned.map((item) => item.fileName),
    });
  }

  const baseline = knownCommit(
    root,
    status.lastSuccessfulUpdate?.releaseCommit ?? null,
  );
  const dataChanges =
    baseline === null
      ? null
      : cumulativeDiff(root, baseline, target, isDataSource);
  if (dataChanges === null) {
    issues.push({ code: "DATA_BASELINE_MISSING", scope: "database" });
  } else if (
    dataChanges.files.length > 0 ||
    status.migrations.pending.length > 0
  ) {
    issues.push({
      code: "DATA_CHANGES_REVIEW",
      scope: "database",
      files: dataChanges.files.map((file) => file.path),
    });
  }
  return { database: { state: "read", status }, dataChanges, issues };
}
