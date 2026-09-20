import type { FieldCategoriesQuery, FieldsQuery } from "@repo/graphql";

/** 左欄的一個欄位類別(全域種子;租戶不可自訂,新增類別走 code + PR)。 */
export type FieldCategoryLike =
  FieldCategoriesQuery["fieldCategories"]["items"][number];

/** 右表格的一列:合併清單的一筆選項(`source` 決定它是全域還是本組織自訂)。 */
export type FieldOptionLike = FieldsQuery["fields"]["items"][number];

/**
 * 本頁會分流的錯誤碼(正本 `docs/modules/field-manager.md`「api 介面」的「錯誤」節)。
 * `FIELD_VALUE_DUPLICATE` 是本模組新增的碼,顯示在新增彈窗的「值」欄位上,不進頁面 Alert。
 * `NOT_OWNER` 不是獨立的 code,是 `FORBIDDEN` 的 `extensions.reason`(#264) ——
 * 本頁把它當成一碼,因為「別的組織加的」與「全域選項」對使用者是兩句不同的話。
 */
export type FieldManagerErrorCode =
  | "FIELD_VALUE_DUPLICATE"
  | "FORBIDDEN"
  | "NOT_OWNER"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "UNEXPECTED";
