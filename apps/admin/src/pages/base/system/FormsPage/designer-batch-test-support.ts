import { expect } from "@jest/globals";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import type { FieldDef, FormDefinition } from "@repo/domain/form";

import {
  SHOPPING_FORM_KEY,
  field,
  formFragment,
  versionFragment,
} from "@/test/msw/form-fixtures";

import {
  defaultDesignOptions,
  renderFormsPage,
} from "./forms-page-test-support";

/**
 * 設計器第二批(固定值、表達式選擇器、帶入自己)測試的共用夾具:一份各型別各一欄的草稿與幾個操作 helper。
 * 分兩個測試檔(`FormsPageDesignerTypedValues` / `FormsPageDesignerExpressions`),全套並行時單一 suite 不會過重(TEST-08)。
 */

export const LEAVE_OPTIONS: FieldDef["options"] = {
  kind: "static",
  items: [
    { value: "sick", label: "病假", order: 1, enabled: true },
    { value: "annual", label: "特休", order: 2, enabled: true },
  ],
};

/** 台北 09-01 00:00 */
export const TAIPEI_0901 = "2026-08-31T16:00:00.000Z";

/** 設計器第二批的草稿:各型別各一欄(是 / 否、多選、固定值日期、兩個同來源單選、日期)。 */
export const batchDraft = (): FormDefinition => {
  const fields = [
    field("item", "品項", "text"),
    field("flag", "旗標", "boolean", { widget: { kind: "switch" } }),
    field("tags", "標籤", "multiSelect", {
      widget: { kind: "checkboxGroup" },
      options: LEAVE_OPTIONS,
    }),
    field("day", "固定日", "date", {
      widget: { kind: "datePicker" },
      valueSource: { kind: "constant", value: TAIPEI_0901 },
    }),
    field("demo.form", "假別", "select", {
      widget: { kind: "dropdown" },
      options: LEAVE_OPTIONS,
    }),
    field("prev_leave", "上次假別", "select", {
      widget: { kind: "dropdown" },
      options: LEAVE_OPTIONS,
    }),
    field("paid_on", "付款日", "date", { widget: { kind: "datePicker" } }),
    field("old_kind", "舊假別", "select", {
      widget: { kind: "dropdown" },
      options: {
        kind: "static",
        items: [
          { value: "sick", label: "病假", order: 1, enabled: true },
          { value: "old", label: "舊假", order: 2, enabled: false },
        ],
      },
      valueSource: { kind: "constant", value: "old" },
    }),
  ];
  return {
    fields,
    layout: {
      sections: [
        {
          key: "basic",
          title: "基本",
          rows: fields.map((item) => ({
            cols: [{ fieldKey: item.key, span: 12 }],
          })),
        },
      ],
    },
    summaryMap: { title: "item" },
    prefills: [],
  };
};

export const renderBatch = (currentVersion: number | null = 1) => {
  const options = defaultDesignOptions();
  return renderFormsPage({
    ...options,
    forms: [formFragment({ currentVersion })],
    versions: {
      [SHOPPING_FORM_KEY]: [
        versionFragment(batchDraft(), { baseVersion: 1 }),
        ...(options.versions?.[SHOPPING_FORM_KEY] ?? []).slice(1),
      ],
    },
  });
};

export type Rendered = ReturnType<typeof renderBatch>;

export const savedFields = async (
  user: Rendered["user"],
  world: Rendered["world"],
) => {
  await user.click(screen.getByRole("button", { name: "存草稿" }));
  await waitFor(() => {
    expect(world.inputs.saveFormVersionDraft).toHaveLength(1);
  });
  return world.inputs.saveFormVersionDraft.at(0)?.fields ?? [];
};

/** 以 MUI X 日期選擇器(role group)選某一天(日曆按鈕在轉場中點不到,以 fireEvent 點)。 */
export const pickDay = async (group: HTMLElement, day: string) => {
  fireEvent.click(
    within(group.parentElement ?? document.body).getByRole("button", {
      name: /choose date/i,
    }),
  );
  fireEvent.click(await screen.findByRole("gridcell", { name: day }));
};

/** 公式根的運算子下拉(巢狀的運算也叫「運算」,取第一個)。 */
export const pickRootOperator = async (
  user: Rendered["user"],
  scope: HTMLElement,
  name: string,
) => {
  const [root] = within(scope).getAllByRole("combobox", { name: "運算" });
  await user.click(root);
  await user.click(await screen.findByRole("option", { name }));
};
