/**
 * `update --status --json` / `migrate:status --json` 的唯讀狀態(`docs/deployment.md`「設定與資料更新」、
 * 「發布前環境與資料核對」;ADR-0002)。輸出形狀的正本是本檔的 `UpdateStatusJson`。
 *
 * 沿用 status 同一份計畫、changelog、journal 與鎖的查詢:不取得鎖、不建立 collection、不寫任何東西。
 * 只輸出固定欄位(不帶 raw error、report、owner 以外的鎖欄位或業務文件)。exit 0 只代表讀取完成,
 * 不代表可以安全部署:最後一次成功之後的 failed、down、reset、未完成紀錄與鎖都要一起看。
 */
import type { Db, Document } from "mongodb";

import { SEED_UPDATE_RUNS_COLLECTION } from "@repo/domain/seed";

import {
  type MigrationJournalRecord,
  UPDATE_OPERATIONS,
  findOpenMigrations,
  findUnfinishedUpdate,
} from "./journal";
import { currentSeedLock } from "./lock";
import { type UpdatePlan, UpdatePlanError } from "./plan";

const FULL_SHA = /^[0-9a-f]{40}$/;

/** 一次執行的摘要(`seed_update_runs` 的 `type: "run"`)。 */
export interface RunSummary {
  runId: string;
  operation: string;
  status: string;
  stage: string;
  releaseCommit: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export const STATUS_JSON_FLAG = "--json";

/** 這次指令是不是 `--json`(含帶值的錯誤寫法:那也要走固定代碼的錯誤輸出)。 */
export function isStatusJsonRequest(argv: readonly string[]): boolean {
  return argv.some(
    (argument) => argument.split("=", 1)[0] === STATUS_JSON_FLAG,
  );
}

/**
 * `--json` 失敗時的固定代碼。stderr 只寫 `{"error":"<代碼>"}`:不回顯參數、來源或驅動程式的原始錯誤
 * (可能帶連線字串、密碼或業務資料),也不帶可由別名改變的前綴。
 */
export type StatusJsonErrorCode =
  | "invalid-arguments"
  | "invalid-sources"
  | "query-failed"
  | "malformed-state"
  | "status-failed";

export class StatusJsonError extends Error {
  override name = "StatusJsonError";

  constructor(readonly code: StatusJsonErrorCode) {
    super(code);
  }
}

/** 執行一段工作;失敗時換成固定代碼(已是固定代碼或來源計畫錯誤的保留原分類)。 */
export async function statusJsonStep<T>(
  fallback: StatusJsonErrorCode,
  work: () => Promise<T>,
): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof StatusJsonError) {
      throw error;
    }
    throw new StatusJsonError(
      error instanceof UpdatePlanError ? "invalid-sources" : fallback,
    );
  }
}

/** 寫到 stderr 的那一行。 */
export function statusJsonErrorLine(error: unknown): string {
  const code = error instanceof StatusJsonError ? error.code : "status-failed";
  return JSON.stringify({ error: code });
}

export interface UpdateStatusJson {
  schemaVersion: 1;
  generatedAt: string;
  sourceCommit: string | null;
  lastAttempt: RunSummary | null;
  lastSuccessfulUpdate: RunSummary | null;
  /** 沒有成功基準時為 null。 */
  subsequentRuns: RunSummary[] | null;
  migrations: {
    applied: { fileName: string; origin: string; appliedAt: string }[];
    pending: { fileName: string; origin: string }[];
    orphaned: { fileName: string; appliedAt: string }[];
    open: {
      fileName: string;
      status: string;
      runId: string;
      releaseCommit: string | null;
    }[];
  };
  definitions: {
    open: { kind: string; key: string; revision: string; runId: string }[];
  };
  lock: {
    owner: string;
    runId: string;
    operation: string;
    releaseCommit: string | null;
    startedAt: string;
  } | null;
}

const RUN_PROJECTION = {
  _id: 0,
  runId: 1,
  operation: 1,
  status: 1,
  stage: 1,
  releaseCommit: 1,
  startedAt: 1,
  finishedAt: 1,
};

function fullShaOrNull(value: unknown): string | null {
  return typeof value === "string" && FULL_SHA.test(value) ? value : null;
}

/*
 * 必填欄位不合形狀(缺欄、型別不對、無效日期)時整次失敗,不輸出半殘的成功結果。
 * 只有 releaseCommit(非完整 SHA → null)與 finishedAt(原本就可為 null)可以是 null。
 */
function requiredString(value: unknown): string {
  if (typeof value !== "string" || value === "") {
    throw new StatusJsonError("malformed-state");
  }
  return value;
}

function requiredDate(value: unknown): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new StatusJsonError("malformed-state");
  }
  return value.toISOString();
}

function nullableDate(value: unknown): string | null {
  return value === null ? null : requiredDate(value);
}

function summaryOf(run: Document): RunSummary {
  return {
    runId: requiredString(run.runId),
    operation: requiredString(run.operation),
    status: requiredString(run.status),
    stage: requiredString(run.stage),
    releaseCommit: fullShaOrNull(run.releaseCommit),
    startedAt: requiredDate(run.startedAt),
    finishedAt: nullableDate(run.finishedAt),
  };
}

async function findRunSummaries(
  database: Db,
  filter: Document,
  order: Record<string, 1 | -1>,
  limit = 0,
): Promise<RunSummary[]> {
  // limit 0 = 不限筆數(mongodb driver 的語意)
  const runs = await database
    .collection(SEED_UPDATE_RUNS_COLLECTION)
    .find(
      { type: "run", ...filter },
      { projection: RUN_PROJECTION, sort: order, limit },
    )
    .toArray();
  return runs.map((run) => summaryOf(run));
}

/** 最後一次開始的執行、最後一次完成的成功 update / reset,以及在它開始之後開始或結束的其他執行。 */
async function readRuns(
  database: Db,
): Promise<
  Pick<
    UpdateStatusJson,
    "lastAttempt" | "lastSuccessfulUpdate" | "subsequentRuns"
  >
> {
  const [lastAttempt = null] = await findRunSummaries(
    database,
    {},
    { startedAt: -1, runId: -1 },
    1,
  );
  const [baseline = null] = await findRunSummaries(
    database,
    {
      operation: { $in: UPDATE_OPERATIONS },
      status: "succeeded",
      stage: "done",
      finishedAt: { $type: "date" },
    },
    { finishedAt: -1, startedAt: -1, runId: -1 },
    1,
  );
  if (baseline === null) {
    return {
      lastAttempt,
      lastSuccessfulUpdate: baseline,
      subsequentRuns: null,
    };
  }
  const since = new Date(baseline.startedAt);
  const subsequentRuns = await findRunSummaries(
    database,
    {
      runId: { $ne: baseline.runId },
      $or: [{ startedAt: { $gte: since } }, { finishedAt: { $gte: since } }],
    },
    { startedAt: 1, runId: 1 },
  );
  return { lastAttempt, lastSuccessfulUpdate: baseline, subsequentRuns };
}

function compareFileNames(
  left: { fileName: string },
  right: { fileName: string },
): number {
  if (left.fileName === right.fileName) {
    return 0;
  }
  return left.fileName < right.fileName ? -1 : 1;
}

/**
 * 來源漂移:未完成的 migration 紀錄與同名的來源檔內容不同(已發布的 migration 被改寫)→ `invalid-sources`。
 * 與 update 接續前的核對同一個判準,但這裡只比對、不接續也不寫任何紀錄;來源已不存在的照常列出。
 */
function assertOpenSourcesUnchanged(
  plan: UpdatePlan,
  open: readonly MigrationJournalRecord[],
): void {
  const hashes = new Map(
    plan.sources.map(({ fileName, sourceHash }) => [fileName, sourceHash]),
  );
  for (const { fileName, sourceHash } of open) {
    const current = hashes.get(fileName);
    if (current !== undefined && current !== sourceHash) {
      throw new StatusJsonError("invalid-sources");
    }
  }
}

/** 以目前的計畫讀出整份狀態(唯讀)。 */
export async function readUpdateStatus(
  database: Db,
  plan: UpdatePlan,
  sourceCommit: string | null,
): Promise<UpdateStatusJson> {
  const origins = new Map(
    plan.sources.map(({ fileName, origin }) => [fileName, origin]),
  );
  const runs = await readRuns(database);
  const open = await findOpenMigrations(database);
  assertOpenSourcesUnchanged(plan, open);
  const { installations } = await findUnfinishedUpdate(database);
  const lock = await currentSeedLock(database);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceCommit,
    ...runs,
    migrations: {
      applied: plan.applied.map(({ fileName, appliedAt }) => ({
        fileName,
        origin: requiredString(origins.get(fileName)),
        appliedAt: requiredDate(appliedAt),
      })),
      pending: plan.pending.map(({ source }) => ({
        fileName: source.fileName,
        origin: source.origin,
      })),
      orphaned: plan.orphaned
        .map(({ fileName, appliedAt }) => ({
          fileName: requiredString(fileName),
          appliedAt: requiredDate(appliedAt),
        }))
        .toSorted(compareFileNames),
      open: open.map(({ fileName, status, runId, releaseCommit }) => ({
        fileName: requiredString(fileName),
        status: requiredString(status),
        runId: requiredString(runId),
        releaseCommit: fullShaOrNull(releaseCommit),
      })),
    },
    definitions: {
      open: installations.map(({ kind, key, revision, runId }) => ({
        kind: requiredString(kind),
        key: requiredString(key),
        revision: requiredString(revision),
        runId: requiredString(runId),
      })),
    },
    lock:
      lock === null
        ? null
        : {
            owner: requiredString(lock.owner),
            runId: requiredString(lock.runId),
            operation: requiredString(lock.operation),
            releaseCommit: fullShaOrNull(lock.releaseCommit),
            startedAt: requiredDate(lock.startedAt),
          },
  };
}
