/**
 * `data` 模式的「seed 管 / 人建」判準(正本:ADR-0002「還原(reset)」)。
 *
 * **判準只有一個來源:registry**。每個 documents 種子表宣告了識別鍵欄位(`keyField`,預設 `key`)
 * 與所有已宣告的 key,所以「這一筆是不是 seed 管的」= 「它的識別鍵在宣告清單裡嗎」。
 * 不另外看 `isSystem`(那是保護旗標,人建的租戶副本也可能被掛上)、也不硬寫「哪些 collection 有哪些筆」。
 *
 * 純函式、不碰資料庫。
 */
import type { SeedRegistry } from "../seed/seed-declaration";

export const CORE_RELATIONSHIPS_COLLECTION = "core_relationships";
export const USERS_COLLECTION = "users";

/** migrate-mongo 自建的遷移紀錄與鎖(ADR-0002:唯一新增物);`data` 模式完全不動。 */
export const PRESERVED_COLLECTIONS: readonly string[] = [
  "changelog",
  "changelog_lock",
];

/**
 * seed 灌的**示範業務資料**(`seeds/demo-items.ts`):`data` 模式整表清空,
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
  | { kind: "keep-seed-keys"; keyField: string; keys: string[] }
  | { kind: "keep-root-admin" }
  | { kind: "relations" };

export interface SeedManagedKeys {
  /** 存放 key 的欄位名(`data_scope_targets` 用 `collection`)。 */
  keyField: string;
  /** registry 宣告過的所有 key。 */
  keys: string[];
}

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
 * 遷移紀錄不動 → 關聯表另外算(任一端指向被刪文件才刪)→ 使用者只留 root 初始帳號
 * → 示範業務資料整表清空 → registry 管的留下宣告過的 key → 其餘(人建的業務資料)整表清空。
 */
export function planFor(
  collection: string,
  managed: ReadonlyMap<string, SeedManagedKeys>,
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
  const seeded = managed.get(collection);
  if (seeded) {
    return { kind: "keep-seed-keys", ...seeded };
  }
  return { kind: "wipe" };
}
