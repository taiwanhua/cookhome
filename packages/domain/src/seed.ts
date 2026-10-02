/**
 * `@repo/domain/seed` 的出口檔(bunchee 由 `exports` 名反推本檔;GEN-01 的 packages 邊界例外)。
 * 種子的共用純契約(正本:ADR-0002),db-migrator、api 與 admin 共用,不碰 Node / Nest / 資料庫:
 *
 * - `seed/declaration.ts`:`SeedSet`(documents / relations / root-admin / 兩種版本化定義)、seedRef、revision 格式
 * - `seed/definition-shape.ts`:定義宣告的形狀檢查(頂層鍵、格式、必填與 null 語意)
 * - `seed/portable-definition.ts`、`seed/portable-expression.ts`:可攜性規則(`validatePortableDefinition`)與 ID 語意
 * - `seed/canonical.ts`:穩定正規化、`contentHash` / `snapshotHash` 的來源字串(雜湊函式由上層注入)
 * - `seed/serialize.ts`:`serializeSeedSet`,輸出可直接登記的 `.ts`
 * - `seed/protocol.ts`:db-migrator ↔ api CLI 的程序協定、共用互斥鎖與紀錄 collection 的識別常數
 */
export * from "./seed/canonical";
export * from "./seed/declaration";
export * from "./seed/definition-shape";
export * from "./seed/portable-definition";
export * from "./seed/portable-expression";
export * from "./seed/protocol";
export * from "./seed/serialize";
