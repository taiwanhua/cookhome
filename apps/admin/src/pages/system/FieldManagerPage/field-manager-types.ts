import type { FieldCategoriesQuery, FieldsQuery } from "@repo/graphql";

/** 左欄的一個欄位類別(全域種子;租戶不可自訂,新增類別走 code + PR)。 */
export type FieldCategoryLike =
  FieldCategoriesQuery["fieldCategories"]["items"][number];

/** 右表格的一列:合併清單的一筆選項(`source` 決定它是全域還是本組織自訂)。 */
export type FieldOptionLike = FieldsQuery["fields"]["items"][number];

/**
 * 本頁會分流的錯誤碼(正本 `docs/modules/field-manager.md`「api 介面」的「錯誤」節)。
 * `FIELD_VALUE_DUPLICATE` 是本模組新增的碼,顯示在新增彈窗的「值」欄位上,不進頁面 Alert。
 */
export type FieldManagerErrorCode =
  | "FIELD_VALUE_DUPLICATE"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "UNEXPECTED";
