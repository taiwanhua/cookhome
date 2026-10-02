/**
 * `seed_update_runs`:update 的執行紀錄與每支 migration 的續跑 journal
 * (`docs/plans/seed-migration.md`「Migration 與設定的執行契約」)。
 *
 * 這是執行紀錄,不是第二份設定正本。同一張表放兩種文件,以 `type` 區分:
 *
 * - `run`:一次最外層命令(commit、計畫 hash、狀態與階段、結果摘要)
 * - `migration`:一支 migration 的一次嘗試。狀態依序 `preparing`(依賴安裝前已記下來源與當時的檢視)
 *   → `started`(up 之前已記下解析好的 context)→ `verified`(verify 通過,尚待 migrate-mongo 記 changelog)
 *   → `applied`;`rollback-in-progress` → `rolled-back` 是 down。停在前四個「未完成」狀態的紀錄
 *   由下一次執行依**保存的 context** 接續,不重新當成第一次。
 * - `unlock`:操作者指名解除鎖的紀錄
 *
 * 每一筆寫入之前核對整批鎖還在自己手上;狀態轉移以目前狀態為條件(不會把別的狀態蓋掉)。
 */
import type { Collection, Db, Document, ObjectId } from "mongodb";

import {
  type DefinitionSeedKind,
  SEED_DEFINITION_INSTALLATIONS_COLLECTION,
  SEED_UPDATE_RUNS_COLLECTION,
  type SeedLockDocument,
} from "@repo/domain/seed";

import { type SeedLockHandle, assertSeedLockOwner } from "./lock";

/** migration 的 `up(db, client, context)` / `verify(db, context)` 拿到的一份已解析定義。 */
export interface MigrationDefinitionContext {
  kind: DefinitionSeedKind;
  key: string;
  revision: string;
  contentHash: string;
  snapshotHash: string;
  /** 該環境的定義 id。 */
  definitionId: string;
  /** 該環境的版號(不是來源環境的版號)。 */
  localVersion: number;
}

/** 傳給 migration 的 context:一經記下就不再改,續跑沿用同一份。 */
export interface MigrationContext {
  definitions: MigrationDefinitionContext[];
  releaseCommit: string;
  runId: string;
}

/** `assertSeedInstallable(db, inspection)` 看到的一份依賴(不含種子內容;journal 也存這個形狀)。 */
export interface InspectedDependency {
  path: string;
  fileHash: string;
  kind: string;
  /** 以下只有版本化定義有值。 */
  key: string | null;
  revision: string | null;
  contentHash: string | null;
  snapshotHash: string | null;
  /** 這個 revision 是否已安裝在該環境(已安裝才有映射)。 */
  installed: boolean;
  definitionId: string | null;
  localVersion: number | null;
  /** 該定義目前的發布版號與內容 hash(沒有為 null)。 */
  currentVersion: number | null;
  currentContentHash: string | null;
}

/** 記在 journal 的檢視結果:每個依賴的狀態與待安裝清單。 */
export interface RecordedInspection {
  snapshots: InspectedDependency[];
  /** 待安裝的快照路徑(依安裝順序)。 */
  pending: string[];
}

export const MIGRATION_OPEN_STATUSES = [
  "preparing",
  "started",
  "verified",
  "rollback-in-progress",
] as const;

export type MigrationOpenStatus = (typeof MIGRATION_OPEN_STATUSES)[number];

export type MigrationJournalStatus =
  | MigrationOpenStatus
  /** migrate-mongo 已記 changelog。 */
  | "applied"
  /** 沒有待轉換資料的 no-op 核對不過:沒有寫入任何資料,下次重新判斷。 */
  | "failed"
  | "rolled-back";

/**
 * 這次嘗試怎麼走:`convert` = 有待轉換資料,安裝依賴後執行 up;`noop` = 沒有待轉換資料,只 verify;
 * `plain` = 沒有 seed 依賴的 migration,直接執行 up。
 */
export type MigrationMode = "convert" | "noop" | "plain";

/** migration 回報的資料處理筆數(`up` 回傳的物件;沒回報為 null)。 */
export interface MigrationStats {
  processed: number | null;
  skipped: number | null;
  conflicts: number | null;
}

export interface MigrationJournalRecord {
  _id: ObjectId;
  type: "migration";
  fileName: string;
  status: MigrationJournalStatus;
  mode: MigrationMode;
  /** 建立這筆紀錄時的來源檔 hash;續跑時來源不同就拒絕。 */
  sourceHash: string;
  /** 建立這筆紀錄的那次執行(context 的 runId / releaseCommit 也是它)。 */
  runId: string;
  releaseCommit: string;
  inspection: RecordedInspection | null;
  /** 依賴的安裝檢查點:每裝好一份就記一筆。 */
  installed: MigrationDefinitionContext[];
  context: MigrationContext | null;
  stats: MigrationStats | null;
  error: string | null;
  checkpoints: { status: MigrationJournalStatus; runId: string; at: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

export const RUN_STAGES = [
  "precheck",
  "migrations",
  "seeds",
  "definitions",
  "verify",
  "rollback",
  "done",
] as const;

export type RunStage = (typeof RUN_STAGES)[number];

export type RunStatus = "running" | "succeeded" | "failed" | "aborted";

export interface RunRecord {
  _id: ObjectId;
  type: "run";
  runId: string;
  owner: string;
  operation: string;
  /** 實際設定版本(與 api image 的 SHA 分開記)。 */
  releaseCommit: string;
  planHash: string | null;
  status: RunStatus;
  stage: RunStage;
  error: string | null;
  report: Document | null;
  startedAt: Date;
  finishedAt: Date | null;
}

/** journal 與目前的來源或資料庫狀態矛盾,或有未完成的紀錄擋著;此時不往下執行。 */
export class UpdateJournalError extends Error {
  override name = "UpdateJournalError";
}

function runs(database: Db): Collection {
  return database.collection(SEED_UPDATE_RUNS_COLLECTION);
}

/** 所有未完成的 migration 紀錄(唯讀;reset 的預檢與 status 也用)。 */
export async function findOpenMigrations(
  database: Db,
): Promise<MigrationJournalRecord[]> {
  const records = await runs(database)
    .find({ type: "migration", status: { $in: [...MIGRATION_OPEN_STATUSES] } })
    .sort({ fileName: 1, createdAt: 1 })
    .toArray();
  return records as MigrationJournalRecord[];
}

/** 會套用種子與定義的操作(一次完整的 update,或內含 update 的 reset);down 不在內。 */
const UPDATE_OPERATIONS = ["update", "reset-data", "reset-full"];

/** 尚未完成的 update:未完成的 migration 紀錄、最近一次沒有走完的執行(沒有為 null)、中斷的定義安裝。 */
/** 一筆還沒走完的受管定義安裝(api 的 `seed_definition_installations`;這裡只讀)。 */
export interface UnfinishedInstallation {
  kind: DefinitionSeedKind;
  key: string;
  revision: string;
  /** 登記這筆安裝的那次執行。 */
  runId: string;
}

/** api 安裝紀錄的「尚未完成」狀態(另一個值是 `installed`)。 */
const INSTALLATION_IN_PROGRESS = "in-progress";

export interface UnfinishedUpdate {
  migrations: MigrationJournalRecord[];
  run: RunRecord | null;
  /** 中斷的受管定義安裝(不論之後有沒有成功的執行)。 */
  installations: UnfinishedInstallation[];
}

/**
 * 目前有沒有未完成的 update(唯讀;down 與 reset 的預檢共用)。完成的邊界是**最近一次**會套用種子的執行:
 *
 * - 有任何未完成的 migration 紀錄 → 未完成
 * - 最近一次執行不是 `succeeded`(失敗、被硬中止後解鎖的 `aborted`、或還掛著 `running`)→ 未完成:
 *   migration 即使都記完了,普通種子、目前定義的發布或最後核對還沒走完
 * - 之後有一次執行走完,就以它為準;更早的失敗紀錄照樣保留,不再擋
 * - 有 `in-progress` 的受管定義安裝紀錄(api 的安裝流程中斷留下的)→ 未完成。這一條不看執行紀錄:
 *   中斷之後若換成不再登記該定義的 registry,update 會成功,但那筆安裝仍沒有走完;
 *   要以同一個 revision / 內容續跑到 `installed` 才算結束。已完成的安裝紀錄不擋
 *
 * 停在 `precheck` 的失敗不算「最近一次」:預檢沒過代表那次什麼都沒寫,狀態仍由它之前的那一次決定。
 * `excludeRunId`:呼叫端自己這一次(還在執行中)不列入。
 */
export async function findUnfinishedUpdate(
  database: Db,
  excludeRunId?: string,
): Promise<UnfinishedUpdate> {
  const [latest] = await runs(database)
    .find({
      type: "run",
      operation: { $in: UPDATE_OPERATIONS },
      runId: { $ne: excludeRunId ?? null },
      $nor: [{ status: "failed", stage: "precheck" }],
    })
    .sort({ startedAt: -1 })
    .limit(1)
    .toArray();
  const run = latest as RunRecord | undefined;
  const migrations = await findOpenMigrations(database);
  const installations = await database
    .collection(SEED_DEFINITION_INSTALLATIONS_COLLECTION)
    .find<UnfinishedInstallation>(
      { status: INSTALLATION_IN_PROGRESS },
      { projection: { _id: 0, kind: 1, key: 1, revision: 1, runId: 1 } },
    )
    .sort({ kind: 1, key: 1, revision: 1 })
    .toArray();
  return {
    installations,
    migrations: migrations.filter(
      ({ status }) => status !== "rollback-in-progress",
    ),
    run: run === undefined || run.status === "succeeded" ? null : run,
  };
}

/** 最近的執行紀錄(唯讀)。 */
export async function findRecentRuns(
  database: Db,
  limit: number,
): Promise<RunRecord[]> {
  const records = await runs(database)
    .find({ type: "run" })
    .sort({ startedAt: -1 })
    .limit(limit)
    .toArray();
  return records as RunRecord[];
}

/** 記下操作者指名解除的鎖,並把那次還停在 running 的執行標成 aborted。 */
export async function recordUnlock(
  database: Db,
  lock: SeedLockDocument,
): Promise<void> {
  const now = new Date();
  await runs(database).insertOne({
    type: "unlock",
    owner: lock.owner,
    runId: lock.runId,
    operation: lock.operation,
    releaseCommit: lock.releaseCommit,
    lockedAt: lock.startedAt,
    unlockedAt: now,
  });
  await runs(database).updateOne(
    { type: "run", runId: lock.runId, status: "running" },
    {
      $set: {
        status: "aborted",
        error: "程序未正常結束;鎖由操作者指名解除",
        finishedAt: now,
      },
    },
  );
}

export interface NewMigrationRecord {
  fileName: string;
  sourceHash: string;
  status: "preparing" | "started" | "rollback-in-progress";
  mode: MigrationMode;
  inspection: RecordedInspection | null;
  context: MigrationContext | null;
}

/** 一次最外層命令的 journal 寫入端(持鎖者才能用)。 */
export class UpdateJournal {
  constructor(
    private readonly database: Db,
    private readonly lock: SeedLockHandle,
  ) {}

  private get collection(): Collection {
    return runs(this.database);
  }

  /** 建立(或在清庫後重建)這次執行的紀錄。 */
  async beginRun(planHash: string | null, stage: RunStage): Promise<void> {
    await assertSeedLockOwner(this.database, this.lock);
    const { runId, owner, operation, releaseCommit } = this.lock;
    await this.collection.updateOne(
      { type: "run", runId },
      {
        $set: { planHash, stage, status: "running", error: null },
        $setOnInsert: {
          owner,
          operation,
          releaseCommit,
          report: null,
          startedAt: new Date(),
          finishedAt: null,
        },
      },
      { upsert: true },
    );
  }

  async setStage(stage: RunStage): Promise<void> {
    await assertSeedLockOwner(this.database, this.lock);
    await this.collection.updateOne(
      { type: "run", runId: this.lock.runId },
      { $set: { stage } },
    );
  }

  /** 結束這次執行;未完成的不會被記成成功(只有呼叫端明確給 `succeeded`)。 */
  async finishRun(
    status: "succeeded" | "failed",
    result: { error?: string; report?: object },
  ): Promise<void> {
    await this.collection.updateOne(
      { type: "run", runId: this.lock.runId },
      {
        $set: {
          status,
          ...(status === "succeeded" ? { stage: "done" } : {}),
          error: result.error ?? null,
          report: result.report ?? null,
          finishedAt: new Date(),
        },
      },
    );
  }

  openMigrations(): Promise<MigrationJournalRecord[]> {
    return findOpenMigrations(this.database);
  }

  /** 某支 migration 最近一次已記 changelog 的紀錄(down 接著它轉成還原中;沒有回 null)。 */
  async latestApplied(
    fileName: string,
  ): Promise<MigrationJournalRecord | null> {
    const [record] = await this.collection
      .find({ type: "migration", fileName, status: "applied" })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();
    return (record as MigrationJournalRecord | undefined) ?? null;
  }

  async createMigration(
    input: NewMigrationRecord,
  ): Promise<MigrationJournalRecord> {
    await assertSeedLockOwner(this.database, this.lock);
    const now = new Date();
    const record: Omit<MigrationJournalRecord, "_id"> = {
      type: "migration",
      fileName: input.fileName,
      status: input.status,
      mode: input.mode,
      sourceHash: input.sourceHash,
      runId: this.lock.runId,
      releaseCommit: this.lock.releaseCommit,
      inspection: input.inspection,
      installed: [],
      context: input.context,
      stats: null,
      error: null,
      checkpoints: [{ status: input.status, runId: this.lock.runId, at: now }],
      createdAt: now,
      updatedAt: now,
    };
    const { insertedId } = await this.collection.insertOne(record);
    return { ...record, _id: insertedId };
  }

  /** 記下一份依賴已安裝(檢查點)。 */
  async recordInstalled(
    record: MigrationJournalRecord,
    installed: MigrationDefinitionContext,
  ): Promise<MigrationJournalRecord> {
    await assertSeedLockOwner(this.database, this.lock);
    return this.update(record, ["preparing"], {
      $push: { installed },
      $set: { updatedAt: new Date() },
    });
  }

  /**
   * 狀態轉移:只有目前狀態在 `from` 裡才會成功,否則丟 `UpdateJournalError`
   * (紀錄被別的程序動過,或流程走到不該到的地方)。
   */
  async transition(
    record: MigrationJournalRecord,
    from: readonly MigrationJournalStatus[],
    status: MigrationJournalStatus,
    fields: Partial<
      Pick<MigrationJournalRecord, "context" | "stats" | "error">
    > = {},
  ): Promise<MigrationJournalRecord> {
    await assertSeedLockOwner(this.database, this.lock);
    const now = new Date();
    return this.update(record, from, {
      $set: { ...fields, status, updatedAt: now },
      $push: { checkpoints: { status, runId: this.lock.runId, at: now } },
    });
  }

  private async update(
    record: MigrationJournalRecord,
    from: readonly MigrationJournalStatus[],
    update: Document,
  ): Promise<MigrationJournalRecord> {
    const updated = await this.collection.findOneAndUpdate(
      { _id: record._id, status: { $in: [...from] } },
      update,
      { returnDocument: "after" },
    );
    if (updated === null) {
      throw new UpdateJournalError(
        `${record.fileName} 的執行紀錄已不是 ${from.join(" / ")}(被其他程序改過?),停止執行`,
      );
    }
    return updated as MigrationJournalRecord;
  }
}
