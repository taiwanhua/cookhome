/**
 * db-migrator ↔ api CLI 的程序協定與共用互斥鎖的識別常數(唯一正本)。
 *
 * migrator 以子程序啟動 api 的受控 CLI:stdin 送一份 `DefinitionSeedRequest` JSON、stdout 收一份
 * `DefinitionSeedResult` JSON,診斷只到 stderr。這是機器傳輸格式,不進 repo、不是要維護的設定格式。
 * 兩端都以本檔的 `parse*` 驗形狀:格式不符或帶任何 `errors` 都算整批失敗。
 */
import { SEED_HASH_PATTERN, isPlainRecord, joinSeedPath } from "./canonical";
import {
  DEFINITION_SEED_KINDS,
  type DefinitionSeedKind,
  type DefinitionSeedSet,
} from "./declaration";
import { definitionSeedShapeIssues } from "./definition-shape";

export const DEFINITION_SEED_PROTOCOL_VERSION = 1;

/** `apply` = 安裝 / 續跑;`inspect` = 只核對既有映射與凍結內容,不寫入。 */
export const DEFINITION_SEED_OPERATIONS = ["apply", "inspect"] as const;

export type DefinitionSeedOperation =
  (typeof DEFINITION_SEED_OPERATIONS)[number];

export interface DefinitionSeedRequest {
  protocolVersion: typeof DEFINITION_SEED_PROTOCOL_VERSION;
  /** 本次執行的識別(安裝紀錄與續跑用)。 */
  runId: string;
  /** 最外層命令持有的鎖 owner token;CLI 只核對,不重搶鎖。 */
  lockOwner: string;
  /** 實際設定版本(與 api image 的 SHA 分開記)。 */
  releaseCommit: string;
  operation: DefinitionSeedOperation;
  /** 依引用拓樸排好的定義宣告(被引用者在前)。 */
  seeds: DefinitionSeedSet[];
}

/** 一筆定義的處理結果(與普通種子摘要同一組詞)。 */
export const DEFINITION_SEED_OUTCOMES = [
  "created",
  "updated",
  "adopted",
  "unchanged",
] as const;

export type DefinitionSeedOutcome = (typeof DEFINITION_SEED_OUTCOMES)[number];

/**
 * `inspect` 專用:這個 revision 在該環境尚未安裝。它不是失敗、也不是完成 —— 呼叫端要自己分支
 * (決定要不要 apply),所以不借用 `created` 等「已完成」的字眼。
 */
export const DEFINITION_SEED_ABSENT = "absent";

/** 各操作可以回報的結果:`apply` 只會是四種完成結果;`inspect` 只核對,不會「新增 / 更新 / 採納」。 */
const OUTCOMES_BY_OPERATION: Readonly<
  Record<
    DefinitionSeedOperation,
    readonly (DefinitionSeedOutcome | typeof DEFINITION_SEED_ABSENT)[]
  >
> = {
  apply: DEFINITION_SEED_OUTCOMES,
  inspect: ["unchanged", DEFINITION_SEED_ABSENT],
};

/** 具體衝突:`code` 給程式判斷,`message` 給操作者。 */
export interface DefinitionSeedConflict {
  code: string;
  message: string;
}

export interface DefinitionSeedItemResult {
  kind: DefinitionSeedKind;
  key: string;
  revision: string;
  contentHash: string;
  snapshotHash: string;
  /** 該環境的定義 id;尚未建立為 null(完成結果一定有值)。 */
  definitionId: string | null;
  /** 該環境的版號(來源環境的版號不是目標),正整數;尚未配置為 null(完成結果一定有值)。 */
  localVersion: number | null;
  /**
   * 處理結果。四種完成結果代表這個 revision 已對應到 `definitionId` + `localVersion`;
   * `absent` 只出現在 `inspect`(尚未安裝,`localVersion` 為 null);發生衝突時為 null、原因在 `conflict`。
   */
  outcome: DefinitionSeedOutcome | typeof DEFINITION_SEED_ABSENT | null;
  conflict: DefinitionSeedConflict | null;
  /** `inspect` 另附:該定義目前的 `currentVersion`(正整數;沒有發布中的版本為 null)。 */
  currentVersion?: number | null;
  /** `inspect` 另附:目前發布版本內容的 contentHash(沒有為 null)。 */
  currentContentHash?: string | null;
}

/** 不屬於單一定義的失敗(操作者不適用、鎖不符、協定不符…),或指名某一筆的錯誤。 */
export interface DefinitionSeedError {
  code: string;
  message: string;
  kind?: DefinitionSeedKind;
  key?: string;
  revision?: string;
}

export interface DefinitionSeedResult {
  results: DefinitionSeedItemResult[];
  errors: DefinitionSeedError[];
}

/** 協定資料形狀不符時丟出;訊息指出位置。 */
export class DefinitionSeedProtocolError extends Error {
  override name = "DefinitionSeedProtocolError";
}

function requireNonBlank(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DefinitionSeedProtocolError(`${path} 必須是非空字串`);
  }
  return value;
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isPlainRecord(value)) {
    throw new DefinitionSeedProtocolError(`${path} 必須是物件`);
  }
  return value;
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new DefinitionSeedProtocolError(`${path} 必須是陣列`);
  }
  return value as unknown[];
}

function requireOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): T {
  if (!(allowed as readonly unknown[]).includes(value)) {
    throw new DefinitionSeedProtocolError(
      `${path} 必須是 ${allowed.join(" / ")}`,
    );
  }
  return value as T;
}

function nullableOf<T>(
  value: unknown,
  path: string,
  read: (present: unknown, at: string) => T,
): T | null {
  return value === null ? null : read(value, path);
}

/** 版號從 1 起算。 */
function requireVersion(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new DefinitionSeedProtocolError(`${path} 必須是正整數`);
  }
  return value;
}

function requireHash(value: unknown, path: string): string {
  if (typeof value !== "string" || !SEED_HASH_PATTERN.test(value)) {
    throw new DefinitionSeedProtocolError(`${path} 必須是 sha256:<hex> 格式`);
  }
  return value;
}

/** 驗 stdin 的請求;版本不符、缺欄位或任一份宣告形狀不對都丟 `DefinitionSeedProtocolError`。 */
export function parseDefinitionSeedRequest(
  input: unknown,
): DefinitionSeedRequest {
  const record = requireRecord(input, "request");
  if (record.protocolVersion !== DEFINITION_SEED_PROTOCOL_VERSION) {
    throw new DefinitionSeedProtocolError(
      `protocolVersion 不符(需要 ${String(DEFINITION_SEED_PROTOCOL_VERSION)},收到 ${String(record.protocolVersion)})`,
    );
  }
  const seeds = requireArray(record.seeds, "seeds").map((seed, index) => {
    const [issue] = definitionSeedShapeIssues(seed);
    if (issue !== undefined) {
      const at = joinSeedPath(`seeds.${String(index)}`, issue.path);
      throw new DefinitionSeedProtocolError(`${at}:${issue.detail}`);
    }
    return seed as DefinitionSeedSet;
  });
  return {
    protocolVersion: DEFINITION_SEED_PROTOCOL_VERSION,
    runId: requireNonBlank(record.runId, "runId"),
    lockOwner: requireNonBlank(record.lockOwner, "lockOwner"),
    releaseCommit: requireNonBlank(record.releaseCommit, "releaseCommit"),
    operation: requireOneOf(
      record.operation,
      DEFINITION_SEED_OPERATIONS,
      "operation",
    ),
    seeds,
  };
}

function parseConflict(value: unknown, path: string): DefinitionSeedConflict {
  const record = requireRecord(value, path);
  return {
    code: requireNonBlank(record.code, `${path}.code`),
    message: requireNonBlank(record.message, `${path}.message`),
  };
}

/**
 * 結果與映射要互相吻合:完成結果一定對應到實際的定義 id 與版號(不能回「created」卻沒有映射);
 * 尚未安裝(`absent`)不能帶版號。衝突時映射有就帶、沒有就 null。
 */
function assertMappingMatchesOutcome(
  result: DefinitionSeedItemResult,
  path: string,
): void {
  if (result.outcome === null) {
    return;
  }
  if (result.outcome === DEFINITION_SEED_ABSENT) {
    if (result.localVersion !== null) {
      throw new DefinitionSeedProtocolError(
        `${path}:outcome 為 absent(尚未安裝)時 localVersion 必須是 null`,
      );
    }
    return;
  }
  if (result.definitionId === null || result.localVersion === null) {
    throw new DefinitionSeedProtocolError(
      `${path}:outcome 為 ${result.outcome} 時必須有 definitionId 與 localVersion`,
    );
  }
}

function parseItemResult(
  value: unknown,
  path: string,
  operation: DefinitionSeedOperation,
): DefinitionSeedItemResult {
  const record = requireRecord(value, path);
  const outcome = nullableOf(record.outcome, `${path}.outcome`, (present, at) =>
    requireOneOf(present, OUTCOMES_BY_OPERATION[operation], at),
  );
  const conflict = nullableOf(
    record.conflict,
    `${path}.conflict`,
    parseConflict,
  );
  if ((outcome === null) === (conflict === null)) {
    throw new DefinitionSeedProtocolError(
      `${path} 必須恰好有 outcome 或 conflict 其中之一`,
    );
  }
  const result: DefinitionSeedItemResult = {
    kind: requireOneOf(record.kind, DEFINITION_SEED_KINDS, `${path}.kind`),
    key: requireNonBlank(record.key, `${path}.key`),
    revision: requireNonBlank(record.revision, `${path}.revision`),
    contentHash: requireHash(record.contentHash, `${path}.contentHash`),
    snapshotHash: requireHash(record.snapshotHash, `${path}.snapshotHash`),
    definitionId: nullableOf(
      record.definitionId,
      `${path}.definitionId`,
      requireNonBlank,
    ),
    localVersion: nullableOf(
      record.localVersion,
      `${path}.localVersion`,
      requireVersion,
    ),
    outcome,
    conflict,
  };
  assertMappingMatchesOutcome(result, path);
  if (record.currentVersion !== undefined) {
    result.currentVersion = nullableOf(
      record.currentVersion,
      `${path}.currentVersion`,
      requireVersion,
    );
  }
  if (record.currentContentHash !== undefined) {
    result.currentContentHash = nullableOf(
      record.currentContentHash,
      `${path}.currentContentHash`,
      requireHash,
    );
  }
  return result;
}

function parseError(value: unknown, path: string): DefinitionSeedError {
  const record = requireRecord(value, path);
  const error: DefinitionSeedError = {
    code: requireNonBlank(record.code, `${path}.code`),
    message: requireNonBlank(record.message, `${path}.message`),
  };
  if (record.kind !== undefined) {
    error.kind = requireOneOf(
      record.kind,
      DEFINITION_SEED_KINDS,
      `${path}.kind`,
    );
  }
  if (record.key !== undefined) {
    error.key = requireNonBlank(record.key, `${path}.key`);
  }
  if (record.revision !== undefined) {
    error.revision = requireNonBlank(record.revision, `${path}.revision`);
  }
  return error;
}

/**
 * 驗 stdout 的結果(要給這次請求的 `operation`:兩種操作能回報的結果不同)。
 * 形狀不符、結果與映射不吻合都丟 `DefinitionSeedProtocolError`;呼叫端另判 `errors` 與衝突。
 */
export function parseDefinitionSeedResult(
  input: unknown,
  operation: DefinitionSeedOperation,
): DefinitionSeedResult {
  const record = requireRecord(input, "result");
  return {
    results: requireArray(record.results, "results").map((item, index) =>
      parseItemResult(item, `results.${String(index)}`, operation),
    ),
    errors: requireArray(record.errors, "errors").map((item, index) =>
      parseError(item, `errors.${String(index)}`),
    ),
  };
}

/**
 * 整批是否沒有失敗:沒有 `errors`、也沒有任何一筆衝突。
 * `inspect` 的 `absent` 不算失敗,但也不是已安裝 —— 要知道某一筆有沒有裝好,用 `isDefinitionInstalled`。
 */
export function isDefinitionSeedResultOk(
  result: DefinitionSeedResult,
): boolean {
  return (
    result.errors.length === 0 &&
    result.results.every((item) => item.conflict === null)
  );
}

/** 這一筆是否已對應到該環境的定義與版號(四種完成結果之一)。 */
export function isDefinitionInstalled(
  item: DefinitionSeedItemResult,
): item is DefinitionSeedItemResult & {
  definitionId: string;
  localVersion: number;
  outcome: DefinitionSeedOutcome;
} {
  return item.outcome !== null && item.outcome !== DEFINITION_SEED_ABSENT;
}

// ---- 共用互斥鎖 ----

/** 鎖放在 migrate-mongo 的 `changelog_lock`:固定 `_id` 的一筆文件,原子搶占、依 owner 釋放。 */
export const SEED_LOCK_COLLECTION = "changelog_lock";

export const SEED_LOCK_ID = "seed-update";

/** 會持鎖的最外層命令(只有最外層取得 / 釋放;內部步驟與 api 子程序沿用同一個 owner 只核對)。 */
export const SEED_LOCK_OPERATIONS = [
  "update",
  "migrate-down",
  "reset-data",
  "reset-full",
] as const;

export type SeedLockOperation = (typeof SEED_LOCK_OPERATIONS)[number];

/**
 * 持鎖者記在鎖上的進度。只有 reset 的清除階段會寫:`full` 清庫時執行紀錄(`seed_update_runs`)也會被清掉,
 * 程序硬中止後能留下「做到哪裡」的地方只剩這把不被清除的鎖。
 */
export interface SeedLockProgress {
  /** 執行階段(與執行紀錄的 `stage` 同一組字)。 */
  stage: string;
  /** 該階段的進度說明(沒有為 null)。 */
  detail: string | null;
  updatedAt: Date;
}

/** 鎖文件的欄位(`_id` 固定為 `SEED_LOCK_ID`)。 */
export interface SeedLockDocument {
  _id: typeof SEED_LOCK_ID;
  /** owner token:每次最外層命令產生一個,續步與釋放都以它核對。 */
  owner: string;
  runId: string;
  operation: SeedLockOperation;
  releaseCommit: string;
  startedAt: Date;
  /** 持鎖者依 owner 寫入的進度;沒寫過就沒有這一欄。 */
  progress?: SeedLockProgress;
}

/** 定義安裝紀錄:唯一 `(kind, key, revision)`。 */
export const SEED_DEFINITION_INSTALLATIONS_COLLECTION =
  "seed_definition_installations";

/** update 的執行紀錄(commit、計畫 hash、狀態與階段)。 */
export const SEED_UPDATE_RUNS_COLLECTION = "seed_update_runs";
