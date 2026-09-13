import { isDeepStrictEqual } from "node:util";

import type { Collection, Db, Document } from "mongodb";

import { ensureRootAdmin, readRootAdminInput } from "./root-admin";
import type {
  SeedDocument,
  SeedDocumentSet,
  SeedRegistry,
  SeedRootAdminSet,
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

/** 只挑出與宣告不同的欄位,讓「未變」不產生任何寫入。 */
function pickChangedFields(
  existing: Document,
  desired: Record<string, unknown>,
): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(desired)) {
    if (!isDeepStrictEqual(existing[field], value)) {
      changes[field] = value;
    }
  }
  return changes;
}

async function syncDocument(
  collection: Collection,
  entry: SeedDocument,
  now: Date,
): Promise<SyncOutcome> {
  // 種子記錄一律掛 isSystem 保護(ADR-0002);宣告不得覆寫 key
  const desired = { ...entry.data, key: entry.key, isSystem: true };
  const existing = await collection.findOne({ key: entry.key });

  if (!existing) {
    await collection.insertOne({ ...desired, createdAt: now, updatedAt: now });
    return "created";
  }

  const changes = pickChangedFields(existing, desired);
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
  const counts: SeedCounts = { created: 0, updated: 0, unchanged: 0 };
  for (const entry of set.entries) {
    const outcome = await syncDocument(collection, entry, now);
    counts[outcome] += 1;
  }
  return { label: set.collection, counts };
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

/** 依 registry 順序把所有種子冪等同步到資料庫,回傳每組的新增/更新/未變計數。 */
export async function runSeeds(
  database: Db,
  registry: SeedRegistry,
  context: SeedContext,
): Promise<SeedSetResult[]> {
  const now = new Date();
  const results: SeedSetResult[] = [];
  for (const set of registry) {
    results.push(
      set.kind === "root-admin"
        ? await runRootAdminSet(database, set, context.env, now)
        : await runDocumentSet(database, set, now),
    );
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

export function formatCounts({ created, updated, unchanged }: SeedCounts): string {
  return `新增 ${String(created)} / 更新 ${String(updated)} / 未變 ${String(unchanged)}`;
}
