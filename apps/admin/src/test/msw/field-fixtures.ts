import { FieldSource } from "@repo/graphql";

import type { TestField, TestFieldCategory } from "./field-manager-handlers";

/**
 * 欄位管理頁(#211)的夾具。
 *
 * 形狀以 `docs/modules/field-manager.md`「種子內容」與 #206 的 api 測試斷言為準(TEST-08):
 * 類別全是**全域種子**(租戶不可自訂,新增類別走 code + PR);選項是**合併清單** =
 * 全域種子(`source: GLOBAL`)+ 當前組織自訂(`source: OWN`),不含其他組織的自訂選項。
 *
 * 「甜點」是當前組織自訂的示意(Figma 90:275 的第四列),**不是種子** —— 種子只有
 * 主食 / 小菜 / 飲品三筆(field-manager.md 的種子表)。
 */

const globalField = (
  id: string,
  categoryId: string,
  label: string,
  value: string,
  order: number,
  overrides: Partial<TestField> = {},
): TestField => ({
  id,
  categoryId,
  label,
  value,
  order,
  enabled: true,
  description: null,
  source: FieldSource.Global,
  ...overrides,
});

const ownField = (
  id: string,
  categoryId: string,
  label: string,
  value: string,
  order: number,
  overrides: Partial<TestField> = {},
): TestField =>
  globalField(id, categoryId, label, value, order, {
    source: FieldSource.Own,
    ...overrides,
  });

/** 左欄類別(依 seed 宣告順序,不分頁)。 */
export const fieldCategories: TestFieldCategory[] = [
  {
    id: "cat-gender",
    key: "gender",
    name: "性別",
    description: "使用者資料的性別選項",
  },
  {
    id: "cat-demo",
    key: "demo-category",
    name: "示範分類",
    description: null,
  },
];

/**
 * 示範分類的合併清單:三筆全域種子 + 一筆當前組織自訂。
 * 「飲品」刻意是停用的,用來驗「停用只是狀態、選項不刪」與開關的初始值。
 */
export const demoCategoryFields: TestField[] = [
  globalField("f-staple", "cat-demo", "主食", "staple", 1),
  globalField("f-side-dish", "cat-demo", "小菜", "side-dish", 2),
  globalField("f-drink", "cat-demo", "飲品", "drink", 3, { enabled: false }),
  ownField("f-dessert", "cat-demo", "甜點", "dessert", 4, {
    description: "本組織自訂",
  }),
];

/** 性別:四筆全域種子(field-manager.md 種子表),沒有自訂選項。 */
export const genderFields: TestField[] = [
  globalField("f-male", "cat-gender", "男", "male", 1),
  globalField("f-female", "cat-gender", "女", "female", 2),
  globalField("f-other", "cat-gender", "其他", "other", 3),
  globalField("f-undisclosed", "cat-gender", "不透露", "undisclosed", 4),
];

/** 預設的 `fields(categoryId)` 回應表。 */
export const fieldsByCategory: Record<string, TestField[]> = {
  "cat-gender": genderFields,
  "cat-demo": demoCategoryFields,
};
