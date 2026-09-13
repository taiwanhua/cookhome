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

export type SeedSet = SeedDocumentSet | SeedRootAdminSet;

/** registry 收齊所有種子;依序執行(被引用者在前)。 */
export type SeedRegistry = SeedSet[];
