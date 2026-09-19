import { HttpResponse } from "msw";

import {
  type CreateFieldMutationVariables,
  type FieldCategoriesQuery,
  FieldSource,
  type FieldsQuery,
  type FieldsQueryVariables,
  type SetFieldEnabledMutationVariables,
  type UpdateFieldMutationVariables,
} from "@repo/graphql";

import { type AuthErrorCode, graphqlError } from "./auth-handlers";
import { api } from "./server";

export type TestFieldCategory =
  FieldCategoriesQuery["fieldCategories"]["items"][number];
export type TestField = FieldsQuery["fields"]["items"][number];

/** 會被指定失敗的操作(值是 `errors[0].extensions.code`)。 */
export type FieldOperation = "CreateField" | "UpdateField" | "SetFieldEnabled";

export interface FieldWorldOptions {
  categories?: TestFieldCategory[];
  /** 類別 id → 合併清單(全域種子 + 當前組織自訂) */
  fieldsByCategory?: Record<string, TestField[]>;
  /**
   * 操作者站在**根組織**:種子選項的 `enabled` 是全域開關,只有根組織切得動
   * (field-manager.md;租戶切種子選項回 `FORBIDDEN`)。預設是租戶視角。
   */
  isRootOperator?: boolean;
  failures?: Partial<Record<FieldOperation, string>>;
}

export interface FieldWorld {
  handlers: Parameters<typeof import("./server").server.use>;
  /** 各操作收到的輸入(依序),用來斷言「送出去的是什麼」 */
  inputs: {
    createField: CreateFieldMutationVariables["input"][];
    updateField: UpdateFieldMutationVariables["input"][];
    setFieldEnabled: SetFieldEnabledMutationVariables["input"][];
  };
  /** `fields` 被打到的次數(驗 invalidate 之後真的重新查了一次) */
  calls: { fields: number };
}

/**
 * 欄位管理頁的假 api(#206 的兩個 query + 三個 mutation)。
 *
 * 清單是**有狀態的**:新增 / 編輯 / 切換寫回同一份資料,所以「mutation → invalidate →
 * 重新查 `fields`」在測試裡看得到新的值 —— 只回固定清單的 handler 驗不出失效有沒有發生。
 * 規則照 `docs/modules/field-manager.md`「api 介面」實作,前端才不會對著一個比 api
 * 寬鬆的假伺服器寫測試:
 *
 * - `createField` 的 `value` 與同類別下**任一筆**(全域或自訂)重複 → `FIELD_VALUE_DUPLICATE`
 * - `updateField` 碰種子選項 → `FORBIDDEN`(種子只能 `setFieldEnabled`,`value` 不在 input 內)
 * - `setFieldEnabled` 碰種子選項而操作者不是根組織 → `FORBIDDEN`
 */
export const fieldWorld = (options: FieldWorldOptions = {}): FieldWorld => {
  const {
    categories = [],
    fieldsByCategory = {},
    isRootOperator = false,
    failures = {},
  } = options;

  const state: Record<string, TestField[]> = structuredClone(fieldsByCategory);
  const inputs: FieldWorld["inputs"] = {
    createField: [],
    updateField: [],
    setFieldEnabled: [],
  };
  const calls = { fields: 0 };
  let created = 0;

  const fail = (operation: FieldOperation) => {
    const code = failures[operation];
    return code === undefined
      ? null
      : graphqlError(code as AuthErrorCode, code);
  };

  const findField = (id: string): TestField | undefined =>
    Object.values(state)
      .flat()
      .find((item) => item.id === id);

  const handlers = [
    api.query("FieldCategories", () =>
      HttpResponse.json({
        data: {
          fieldCategories: {
            items: categories,
            totalCount: categories.length,
          },
        },
      }),
    ),
    api.query("Fields", ({ variables }) => {
      const { categoryId } = variables as FieldsQueryVariables;
      calls.fields += 1;
      const items = (state[categoryId] ?? []).toSorted(
        (left, right) => left.order - right.order,
      );
      return HttpResponse.json({
        data: { fields: { items, totalCount: items.length } },
      });
    }),
    api.mutation("CreateField", ({ variables }) => {
      const { input } = variables as CreateFieldMutationVariables;
      inputs.createField.push(input);
      const failure = fail("CreateField");
      if (failure !== null) {
        return failure;
      }
      const siblings = state[input.categoryId] ?? [];
      if (siblings.some((item) => item.value === input.value)) {
        return graphqlError(
          "FIELD_VALUE_DUPLICATE" as AuthErrorCode,
          "FIELD_VALUE_DUPLICATE",
        );
      }
      created += 1;
      const field: TestField = {
        id: `f-new-${String(created)}`,
        categoryId: input.categoryId,
        label: input.label,
        value: input.value,
        order: input.order ?? 0,
        enabled: true,
        description: input.description ?? null,
        source: FieldSource.Own,
      };
      state[input.categoryId] = [...siblings, field];
      return HttpResponse.json({ data: { createField: { field } } });
    }),
    api.mutation("UpdateField", ({ variables }) => {
      const { input } = variables as UpdateFieldMutationVariables;
      inputs.updateField.push(input);
      const failure = fail("UpdateField");
      if (failure !== null) {
        return failure;
      }
      const target = findField(input.id);
      if (target === undefined) {
        return graphqlError("FORBIDDEN", "NOT_FOUND");
      }
      // 種子選項唯讀(只能切 enabled);api 回 FORBIDDEN 而不是靜默忽略
      if (target.source === FieldSource.Global) {
        return graphqlError("FORBIDDEN", "FORBIDDEN");
      }
      if (input.label !== undefined && input.label !== null) {
        target.label = input.label;
      }
      if (input.order !== undefined && input.order !== null) {
        target.order = input.order;
      }
      if (input.description !== undefined) {
        target.description = input.description;
      }
      return HttpResponse.json({ data: { updateField: { field: target } } });
    }),
    api.mutation("SetFieldEnabled", ({ variables }) => {
      const { input } = variables as SetFieldEnabledMutationVariables;
      inputs.setFieldEnabled.push(input);
      const failure = fail("SetFieldEnabled");
      if (failure !== null) {
        return failure;
      }
      const target = findField(input.id);
      if (target === undefined) {
        return graphqlError("FORBIDDEN", "NOT_FOUND");
      }
      // 種子選項的 enabled 是全域開關:非根組織操作者一律 FORBIDDEN
      if (target.source === FieldSource.Global && !isRootOperator) {
        return graphqlError("FORBIDDEN", "FORBIDDEN");
      }
      target.enabled = input.enabled;
      return HttpResponse.json({
        data: { setFieldEnabled: { field: target } },
      });
    }),
  ];

  return { handlers: handlers as FieldWorld["handlers"], inputs, calls };
};
