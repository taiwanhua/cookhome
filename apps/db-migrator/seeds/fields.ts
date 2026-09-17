import {
  type SeedDocument,
  type SeedDocumentSet,
  seedRef,
} from "../src/seed/seed-declaration";
import { DEMO_CATEGORY_KEY, GENDER_CATEGORY_KEY } from "./field-categories";

interface FieldOption {
  value: string;
  label: string;
}

/**
 * 一個類別下的全域選項:key = `<類別 key>.<value>`(同權限 key 以「.」分層),
 * order 依宣告順序 1 起算;categoryId 於執行時由類別 key 解析成該環境的 _id。
 */
function globalOptions(
  categoryKey: string,
  options: FieldOption[],
): SeedDocument[] {
  return options.map(({ value, label }, index) => ({
    key: `${categoryKey}.${value}`,
    data: {
      categoryId: seedRef("field_categories", categoryKey),
      orgId: null,
      value,
      label,
      order: index + 1,
      enabled: true,
    },
  }));
}

/**
 * 全域欄位選項(orgId=null,ADR-0005;seed 選項僅 enabled 可改、不可刪)。
 * 內容正本:docs/modules/field-manager.md「種子內容」— 示範畫面上的「甜點」是租戶自訂示意,不是種子。
 */
export const fields: SeedDocumentSet = {
  kind: "documents",
  collection: "fields",
  entries: [
    ...globalOptions(GENDER_CATEGORY_KEY, [
      { value: "male", label: "男" },
      { value: "female", label: "女" },
      { value: "other", label: "其他" },
      { value: "undisclosed", label: "不透露" },
    ]),
    ...globalOptions(DEMO_CATEGORY_KEY, [
      { value: "staple", label: "主食" },
      { value: "side-dish", label: "小菜" },
      { value: "drink", label: "飲品" },
    ]),
  ],
};
