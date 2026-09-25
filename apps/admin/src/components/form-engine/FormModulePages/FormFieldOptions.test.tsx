import { describe, expect, it } from "@jest/globals";
import { screen, waitFor } from "@testing-library/react";

import type { FormDefinition } from "@repo/domain/form";

import {
  SHOPPING_FORM_KEY,
  SHOPPING_ROUTES,
  field,
  shoppingDefinition,
} from "@/test/msw/form-fixtures";
import type { FormRuntimeWorldOptions } from "@/test/msw/form-runtime-handlers";

import {
  SHOPPING_ACTIONS,
  renderShopping,
  shoppingForm,
} from "./form-module-test-support";

const CREATE_PATH = `${SHOPPING_ROUTES.createPage}/${SHOPPING_FORM_KEY}`;

/**
 * 購物單 + 必填的類別選項欄「分類」+ api 投影成骨架的計算欄「內部總價」:它只因依賴鏈上的受保護欄位
 * 而讀不到(自己沒設 show),`formRuntimeVersion` 省略了公式、另標 `redacted` —— 前端從權限 key 推不出來。
 */
const definitionWithCategory = (): FormDefinition => {
  const base = shoppingDefinition();
  const [section] = base.layout.sections;
  return {
    ...base,
    fields: [
      ...base.fields,
      field("kind", "分類", "select", {
        widget: { kind: "dropdown" },
        options: { kind: "fieldCategory", key: "demo-category" },
        rules: { required: true },
      }),
      {
        key: "cost_total",
        label: "內部總價",
        type: "number",
        widget: { kind: "number" },
        valueSource: { kind: "computed", expr: null },
        permission: { show: false, edit: false },
        redacted: true,
      },
    ],
    layout: {
      sections: [
        {
          ...section,
          rows: [
            ...section.rows,
            {
              cols: [
                { fieldKey: "kind", span: 6 },
                { fieldKey: "cost_total", span: 6 },
              ],
            },
          ],
        },
      ],
    },
  };
};

const worldWith = (
  overrides: Partial<FormRuntimeWorldOptions> = {},
): FormRuntimeWorldOptions => ({
  moduleForms: [shoppingForm],
  versions: { [`${SHOPPING_FORM_KEY}@1`]: definitionWithCategory() },
  fieldOptions: {
    kind: [
      { value: "drink", label: "飲品" },
      { value: "snack", label: "點心" },
    ],
  },
  ...overrides,
});

describe("表單的類別選項欄與投影過的定義", () => {
  it("一般員工(沒有欄位管理權限)從 formFieldOptions 取類別選項,選了就能送出必填欄", async () => {
    // 只有購物清單的四個動作:沒有 system.field-manager.view
    const { user, world } = renderShopping({
      path: CREATE_PATH,
      permissions: SHOPPING_ACTIONS,
      world: worldWith(),
    });

    await user.type(await screen.findByRole("textbox", { name: "品項" }), "茶");
    const kind = await screen.findByRole("combobox", { name: /分類/ });
    await waitFor(() => {
      expect(kind).not.toHaveAttribute("aria-disabled", "true");
    });
    await user.click(kind);
    await user.click(await screen.findByRole("option", { name: "飲品" }));
    await user.click(screen.getByRole("button", { name: "送出" }));

    await waitFor(() => {
      expect(world.inputs.submitFormSubmission).toHaveLength(1);
    });
    expect(world.inputs.createFormDraft[0]?.values).toMatchObject({
      item: "茶",
      kind: { value: "drink", label: "飲品" },
    });
    // 只帶「哪一版的哪一個欄位」,類別 key 由 api 從定義取
    expect(world.inputs.formFieldOptions[0]).toMatchObject({
      formKey: SHOPPING_FORM_KEY,
      version: 1,
      fieldKey: "kind",
    });
  });

  it("api 投影成骨架(redacted)的欄位整格不渲染", async () => {
    renderShopping({
      path: CREATE_PATH,
      permissions: SHOPPING_ACTIONS,
      world: worldWith(),
    });

    expect(
      await screen.findByRole("combobox", { name: /分類/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("內部總價")).toBeNull();
  });

  it("取類別選項失敗:該欄鎖住並說明只能顯示既有值", async () => {
    renderShopping({
      path: CREATE_PATH,
      permissions: SHOPPING_ACTIONS,
      world: worldWith({
        failures: { FormFieldOptions: { code: "FORBIDDEN" } },
      }),
    });

    expect(
      await screen.findByText("目前無法取得選項,只能顯示既有值。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /分類/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
