import { fieldCategories } from "../../../seeds/field-categories";
import { fields } from "../../../seeds/fields";
import { orgs } from "../../../seeds/orgs";
import { type SeedRegistry, seedRef } from "../../../src/seed/seed-declaration";

/**
 * 夾具 registry(認養):正式的組織 / 類別 / 選項宣告,再多宣告一個 `cuisine` 類別與兩個選項 ——
 * 測試先以「root 在畫面建」的形狀塞好 `cuisine` 與 `spicy`,這一版 seed 應以 key 認養它們;
 * `demo-category` 補一段說明,驗「更新」照常計數。
 */
export const seedRegistry: SeedRegistry = [
  orgs,
  {
    ...fieldCategories,
    entries: [
      ...fieldCategories.entries.map((entry) =>
        entry.key === "demo-category"
          ? { ...entry, data: { ...entry.data, description: "示範用" } }
          : entry,
      ),
      {
        key: "cuisine",
        data: { name: "料理類型", description: null, enabled: true },
      },
    ],
  },
  {
    ...fields,
    entries: [
      ...fields.entries,
      ...[
        { value: "spicy", label: "辣味" },
        { value: "sweet", label: "甜味" },
      ].map(({ value, label }, index) => ({
        key: `cuisine.${value}`,
        data: {
          categoryId: seedRef("field_categories", "cuisine"),
          orgId: null,
          value,
          label,
          order: index + 1,
          enabled: true,
        },
      })),
    ],
  },
];
