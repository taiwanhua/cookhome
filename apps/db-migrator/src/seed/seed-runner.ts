import { isDeepStrictEqual } from "node:util";

import type { Collection, Db, Document, ObjectId } from "mongodb";

import { ensureRootAdmin, readRootAdminInput } from "./root-admin";
import {
  DEFAULT_INITIAL_SEED_VALUE_FIELDS,
  type SeedDocument,
  type SeedDocumentSet,
  type SeedKeyReference,
  type SeedRegistry,
  type SeedRelation,
  type SeedRelationSet,
  type SeedRootAdminSet,
  type SeedSet,
  isSeedIdReference,
} from "./seed-declaration";

export interface SeedCounts {
  created: number;
  updated: number;
  unchanged: number;
}

export interface SeedSetResult {
  label: string;
  counts: SeedCounts;
}

type SyncOutcome = keyof SeedCounts;

/**
 * 只挑出與宣告不同的欄位,讓「未變」不產生任何寫入。
 *
 * 初始 seed 值的欄位(ADR-0002)**有值就永不覆寫** — 那是人在系統內管理的值。
 * 唯一的例外是**欄位根本不存在**:新增一個初始值欄位(如 #288 的 `modules.icon`)時,
 * 已經種過的環境裡的舊文件沒有這一欄,不補就永遠拿不到初值、新功能等於沒上線。
 * 補的是「從未被寫過的欄位」,不是「被改過的值」—— 清成 `null` 也算有值(欄位存在),不會被翻回宣告值。
 */
function pickChangedFields(
  existing: Document,
  desired: Record<string, unknown>,
  initialSeedValueFields: ReadonlySet<string>,
): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(desired)) {
    if (initialSeedValueFields.has(field)) {
      if (!(field in existing)) {
        changes[field] = value;
      }
      continue;
    }
    if (!isDeepStrictEqual(existing[field], value)) {
      changes[field] = value;
    }
  }
  return changes;
}

async function resolveSeedId(
  database: Db,
  reference: SeedKeyReference,
): Promise<ObjectId> {
  const document = await database
    .collection(reference.collection)
    .findOne({ key: reference.key }, { projection: { _id: 1 } });
  if (!document) {
    throw new Error(
      `找不到種子文件 ${reference.collection}.${reference.key},請確認 registry 順序(被引用者在前)`,
    );
  }
  return document._id;
}

async function resolveValue(database: Db, value: unknown): Promise<unknown> {
  if (isSeedIdReference(value)) {
    return resolveSeedId(database, value.$seedRef);
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => resolveValue(database, item)));
  }
  return value;
}

/** 把 data 中的 seedRef 欄位值換成該環境的 _id(只看頂層欄位;頂層陣列逐元素解析)。 */
async function resolveReferences(
  database: Db,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const resolved: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(data)) {
    resolved[field] = await resolveValue(database, value);
  }
  return resolved;
}

interface DocumentSyncOptions {
  /** 存放 entry.key 的欄位名。 */
  keyField: string;
  /** 建立後永不比對、永不覆寫的欄位。 */
  initialSeedValueFields: ReadonlySet<string>;
}

async function syncDocument(
  database: Db,
  collection: Collection,
  options: DocumentSyncOptions,
  entry: SeedDocument,
  now: Date,
): Promise<SyncOutcome> {
  const { keyField, initialSeedValueFields } = options;
  // 種子記錄一律掛 isSystem 保護(ADR-0002);宣告不得覆寫識別鍵
  const desired = {
    ...(await resolveReferences(database, entry.data)),
    [keyField]: entry.key,
    isSystem: true,
  };
  const existing = await collection.findOne({ [keyField]: entry.key });

  if (!existing) {
    await collection.insertOne({ ...desired, createdAt: now, updatedAt: now });
    return "created";
  }

  const changes = pickChangedFields(existing, desired, initialSeedValueFields);
  if (Object.keys(changes).length === 0) {
    return "unchanged";
  }

  await collection.updateOne(
    { _id: existing._id },
    { $set: { ...changes, updatedAt: now } },
  );
  return "updated";
}

async function runDocumentSet(
  database: Db,
  set: SeedDocumentSet,
  now: Date,
): Promise<SeedSetResult> {
  const collection = database.collection(set.collection);
  const options: DocumentSyncOptions = {
    keyField: set.keyField ?? "key",
    initialSeedValueFields: new Set(
      set.initialSeedValueFields ?? DEFAULT_INITIAL_SEED_VALUE_FIELDS,
    ),
  };
  const counts: SeedCounts = { created: 0, updated: 0, unchanged: 0 };
  for (const entry of set.entries) {
    const outcome = await syncDocument(
      database,
      collection,
      options,
      entry,
      now,
    );
    counts[outcome] += 1;
  }
  return { label: set.collection, counts };
}

async function syncRelation(
  database: Db,
  relation: SeedRelation,
  now: Date,
): Promise<SyncOutcome> {
  const collection = database.collection("core_relationships");
  const link = {
    type: relation.type,
    firstId: await resolveSeedId(database, relation.first),
    secondId: await resolveSeedId(database, relation.second),
    thirdId: null,
  };
  const existing = await collection.findOne(link);
  if (existing) {
    return "unchanged";
  }
  await collection.insertOne({ ...link, createdAt: now, updatedAt: now });
  return "created";
}

async function runRelationSet(
  database: Db,
  set: SeedRelationSet,
  now: Date,
): Promise<SeedSetResult> {
  const counts: SeedCounts = { created: 0, updated: 0, unchanged: 0 };
  for (const relation of set.entries) {
    counts[await syncRelation(database, relation, now)] += 1;
  }
  return { label: "core_relationships", counts };
}

async function runRootAdminSet(
  database: Db,
  set: SeedRootAdminSet,
  env: NodeJS.ProcessEnv,
  now: Date,
): Promise<SeedSetResult> {
  const outcome = await ensureRootAdmin(
    database,
    set,
    readRootAdminInput(env),
    now,
  );
  const counts: SeedCounts = { created: 0, updated: 0, unchanged: 0 };
  counts[outcome] += 1;
  return { label: "root-admin", counts };
}

export interface SeedContext {
  /** 供 root 初始帳號讀取 ROOT_ADMIN_* 的環境。 */
  env: NodeJS.ProcessEnv;
}

function runSet(
  database: Db,
  set: SeedSet,
  context: SeedContext,
  now: Date,
): Promise<SeedSetResult> {
  switch (set.kind) {
    case "documents": {
      return runDocumentSet(database, set, now);
    }
    case "relations": {
      return runRelationSet(database, set, now);
    }
    case "root-admin": {
      return runRootAdminSet(database, set, context.env, now);
    }
  }
}

/** 依 registry 順序把所有種子冪等同步到資料庫,回傳每組的新增/更新/未變計數。 */
export async function runSeeds(
  database: Db,
  registry: SeedRegistry,
  context: SeedContext,
): Promise<SeedSetResult[]> {
  const now = new Date();
  const results: SeedSetResult[] = [];
  for (const set of registry) {
    results.push(await runSet(database, set, context, now));
  }
  return results;
}

export function sumCounts(results: SeedSetResult[]): SeedCounts {
  return results.reduce<SeedCounts>(
    (total, { counts }) => ({
      created: total.created + counts.created,
      updated: total.updated + counts.updated,
      unchanged: total.unchanged + counts.unchanged,
    }),
    { created: 0, updated: 0, unchanged: 0 },
  );
}

export function formatCounts({
  created,
  updated,
  unchanged,
}: SeedCounts): string {
  return `新增 ${String(created)} / 更新 ${String(updated)} / 未變 ${String(unchanged)}`;
}
