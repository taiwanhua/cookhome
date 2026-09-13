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

export type SeedSet = SeedDocumentSet;

/** registry 收齊所有種子;依序執行。 */
export type SeedRegistry = SeedSet[];
