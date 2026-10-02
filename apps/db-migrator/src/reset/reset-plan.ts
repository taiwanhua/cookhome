/**
 * `data` 模式的「seed 管 / 人建」判準(正本:ADR-0002「還原(reset)」、
 * `docs/concepts/data-layer-and-isolation.md`「還原」)。
 *
 * **判準只有一個來源:registry**。每個 documents 種子表宣告了識別鍵欄位(`keyField`,預設 `key`)
 * 與所有已宣告的 key,所以「這一筆是不是 seed 管的」= 「它的識別鍵在宣告清單裡嗎」。
 * 不另外看 `isSystem`(那是保護旗標,人建的租戶副本也可能被掛上)、也不硬寫「哪些 collection 有哪些筆」。
 * 例:root 在欄位管理畫面建的類別(`isSystem: false`)key 不在宣告清單裡,所以算人建的、一起刪;
 * 若 seed 已宣告同一個 key,那一筆留著,由同一次執行的 seed 認養。
 *
 * 版本化定義(表單 / 流程)不是 documents 種子,它們的保留閉包由 `reset-retention.ts` 依同一份 registry
 * 與資料庫現況算出(每個 collection 要留哪些 `_id`),再併進這裡的處置。
 *
 * 純函式、不碰資料庫。
 */
import type { ObjectId } from "mongodb";

import {
  SEED_LOCK_COLLECTION,
  SEED_UPDATE_RUNS_COLLECTION,
} from "@repo/domain/seed";

import type { SeedRegistry } from "../seed/seed-declaration";

export const CORE_RELATIONSHIPS_COLLECTION = "core_relationships";
export const USERS_COLLECTION = "users";

/**
 * `data` 模式完全不動的三張表:migrate-mongo 的遷移紀錄(已成功的不重跑)、整批互斥鎖,
 * 以及執行紀錄(含失敗的都留作稽核;這次 reset 另外新建一筆,不以歷史的成功略過實體檢查)。
 */
export const PRESERVED_COLLECTIONS: readonly string[] = [
  "changelog",
  SEED_LOCK_COLLECTION,
  SEED_UPDATE_RUNS_COLLECTION,
];

/**
 * seed 灌的**示範業務資料**(`seeds/base/demo-items.ts`):`data` 模式整表清空,
 * 再由同一次執行的 seed 依宣告補回。它們是資料不是設定 —— 留著等於留下被玩壞的狀態,
 * 而 seed 本來就會把宣告的那幾筆種回來(`enabled` 以外的欄位每次都同步)。
 */
export const RESEEDED_COLLECTIONS: readonly string[] = [
  "demo_items_one",
  "demo_items_two",
];

/** 一個 collection 在 `data` 模式要怎麼處理。 */
export type ResetAction =
  | { kind: "preserve" }
  | { kind: "wipe" }
  | {
      kind: "keep-seed-keys";
      keyField: string;
      keys: string[];
      /** 宣告的 key 之外另外要留的文件(受管定義的動態權限)。 */
      keepIds: ObjectId[];
    }
  /** 只留指定的文件(受管定義的身分、版本與安裝紀錄),其餘清掉。 */
  | { kind: "keep-ids"; ids: ObjectId[] }
  | { kind: "keep-root-admin" }
  | { kind: "relations" };

export interface SeedManagedKeys {
  /** 存放 key 的欄位名(`data_scope_targets` 用 `moduleKey`)。 */
  keyField: string;
  /** registry 宣告過的所有 key。 */
  keys: string[];
}

/** 受管定義的保留閉包:collection → 要留的 `_id`(列在這裡的 collection 其餘文件都清掉)。 */
export type RetainedDocuments = ReadonlyMap<string, readonly ObjectId[]>;

/**
 * registry 裡每個 documents 種子表的識別鍵欄位與已宣告的 key。
 * 同一個 collection 由多個 set 宣告時合併(識別鍵欄位必須一致)。
 */
export function seedManagedKeys(
  registry: SeedRegistry,
): Map<string, SeedManagedKeys> {
  const managed = new Map<string, SeedManagedKeys>();
  for (const set of registry) {
    if (set.kind !== "documents") {
      continue;
    }
    const keyField = set.keyField ?? "key";
    const existing = managed.get(set.collection);
    if (!existing) {
      managed.set(set.collection, {
        keyField,
        keys: set.entries.map((entry) => entry.key),
      });
      continue;
    }
    if (existing.keyField !== keyField) {
      throw new Error(
        `registry 的 ${set.collection} 有兩種識別鍵欄位(${existing.keyField} / ${keyField}),reset 無法判斷哪些是 seed 管的`,
      );
    }
    existing.keys.push(...set.entries.map((entry) => entry.key));
  }
  return managed;
}

/**
 * 一個 collection 的處置。順序即優先序:
 * 遷移紀錄、鎖與執行紀錄不動 → 關聯表另外算(任一端指向被刪文件才刪)→ 使用者只留 root 初始帳號
 * → 示範業務資料整表清空 → registry 管的留下宣告過的 key(加上保留閉包指名的文件)
 * → 保留閉包管的只留指名的文件 → 其餘(人建的業務資料)整表清空。
 */
export function planFor(
  collection: string,
  managed: ReadonlyMap<string, SeedManagedKeys>,
  retained: RetainedDocuments = new Map(),
): ResetAction {
  if (PRESERVED_COLLECTIONS.includes(collection)) {
    return { kind: "preserve" };
  }
  if (collection === CORE_RELATIONSHIPS_COLLECTION) {
    return { kind: "relations" };
  }
  if (collection === USERS_COLLECTION) {
    return { kind: "keep-root-admin" };
  }
  if (RESEEDED_COLLECTIONS.includes(collection)) {
    return { kind: "wipe" };
  }
  const keepIds = retained.get(collection);
  const seeded = managed.get(collection);
  if (seeded) {
    return { kind: "keep-seed-keys", ...seeded, keepIds: [...(keepIds ?? [])] };
  }
  if (keepIds !== undefined) {
    return { kind: "keep-ids", ids: [...keepIds] };
  }
  return { kind: "wipe" };
}
