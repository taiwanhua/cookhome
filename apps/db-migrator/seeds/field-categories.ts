import type { SeedDocumentSet } from "../src/seed/seed-declaration";

export const GENDER_CATEGORY_KEY = "gender";
export const DEMO_CATEGORY_KEY = "demo-category";

/**
 * 欄位類別(母檔;全域種子,租戶不可自訂,ADR-0005)。
 * 內容正本:docs/modules/field-manager.md「種子內容」;新增類別走 code + PR。
 */
export const fieldCategories: SeedDocumentSet = {
  kind: "documents",
  collection: "field_categories",
  entries: [
    { key: GENDER_CATEGORY_KEY, data: { name: "性別" } },
    { key: DEMO_CATEGORY_KEY, data: { name: "示範分類" } },
  ],
};
