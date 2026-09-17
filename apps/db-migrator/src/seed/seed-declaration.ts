/**
 * 種子宣告的型別(正本:ADR-0002)。
 *
 * 種子資料以穩定 kebab-case `key` 在各環境冪等 upsert;id 各環境各自生成。
 * 宣告只描述「要同步的欄位」— `key`、`isSystem`、時間戳由 runner 補上。
 */

/** 一筆以 key 識別的種子文件:`data` 是要同步到資料庫的欄位。 */
export interface SeedDocument {
  key: string;
  data: Record<string, unknown>;
}

/** 同一 collection 的一組種子文件(每模組/每類一檔)。 */
export interface SeedDocumentSet {
  kind: "documents";
  collection: string;
  entries: SeedDocument[];
}

/**
 * root 初始超級管理員帳號(ADR-0002):account/email/密碼自環境變數讀取,
 * 僅在帳號不存在時建立(加入 orgKey 組織 + 授予 roleKey 角色);已存在則完全不動。
 */
export interface SeedRootAdminSet {
  kind: "root-admin";
  orgKey: string;
  roleKey: string;
}

/** 以(collection, key)指向另一筆種子文件;執行時解析成該環境的 _id。 */
export interface SeedKeyReference {
  collection: string;
  key: string;
}

/**
 * 種子文件 `data` 中「指向另一筆種子文件」的欄位值(如 fields.categoryId → field_categories):
 * 宣告時寫 (collection, key),runner 執行時解析成該環境的 _id 再寫入(只支援頂層欄位)。
 */
export interface SeedIdReference {
  $seedRef: SeedKeyReference;
}

export function seedRef(collection: string, key: string): SeedIdReference {
  return { $seedRef: { collection, key } };
}

export function isSeedIdReference(value: unknown): value is SeedIdReference {
  return (
    typeof value === "object" &&
    value !== null &&
    "$seedRef" in value &&
    typeof value.$seedRef === "object"
  );
}

/**
 * 種子之間的核心關聯(ADR-0001;命名順序 Org > User > Role > Module > Permission):
 * 以 (type, firstId, secondId) 冪等,不存在才寫入。
 */
export interface SeedRelation {
  type: string;
  first: SeedKeyReference;
  second: SeedKeyReference;
}

export interface SeedRelationSet {
  kind: "relations";
  entries: SeedRelation[];
}

export type SeedSet = SeedDocumentSet | SeedRelationSet | SeedRootAdminSet;

/** registry 收齊所有種子;依序執行(被引用者在前)。 */
export type SeedRegistry = SeedSet[];
