import { describe, expect, it } from "@jest/globals";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import type { FormDefinition } from "@repo/domain/form";
import { FormSubmissionStatus } from "@repo/graphql";

import {
  SHOPPING_FORM_KEY,
  SHOPPING_ROUTES,
  field,
  submissionFragment,
} from "@/test/msw/form-fixtures";

import { renderShopping, shoppingForm } from "./form-module-test-support";

const CREATE_PATH = `${SHOPPING_ROUTES.createPage}/shopping_list`;
const EDIT_PATH = `${SHOPPING_ROUTES.editPage}/sub-1`;
const VIEW_PATH = `${SHOPPING_ROUTES.viewPage}/sub-1`;

/** 數量預設 2、預算預設 = 數量 × 單價、送達時間(日期時間欄)。 */
const defaultsDefinition = (): FormDefinition => ({
  fields: [
    field("item", "品項", "text"),
    field("qty", "數量", "number", {
      precision: 0,
      widget: { kind: "number" },
      default: { kind: "constant", value: 2 },
    }),
    field("unit_price", "單價", "number", {
      precision: 0,
      widget: { kind: "number" },
    }),
    field("budget", "預算", "number", {
      precision: 0,
      widget: { kind: "number" },
      default: {
        kind: "expression",
        expr: { "*": [{ var: "qty" }, { var: "unit_price" }] },
      },
    }),
    field("deliver_at", "送達時間", "datetime", {
      widget: { kind: "dateTimePicker" },
    }),
  ],
  layout: {
    sections: [
      {
        key: "basic",
        title: "採購內容",
        rows: [
          { cols: [{ fieldKey: "item", span: 12 }] },
          {
            cols: [
              { fieldKey: "qty", span: 4 },
              { fieldKey: "unit_price", span: 4 },
              { fieldKey: "budget", span: 4 },
            ],
          },
          { cols: [{ fieldKey: "deliver_at", span: 12 }] },
        ],
      },
    ],
  },
  summaryMap: { title: "item" },
  prefills: [],
});

/** 這一版每個使用者填的欄位都改得動(api 的 `abilities.canEditField`)。 */
const EDITABLE = {
  canEdit: true,
  canDelete: true,
  canEditField: ["item", "qty", "unit_price", "budget", "deliver_at"],
  canWithdraw: false,
  canVoid: false,
  canCopy: false,
};

const worldWith = (
  submissions: ReturnType<typeof submissionFragment>[] = [],
) => ({
  moduleForms: [shoppingForm],
  versions: { [`${SHOPPING_FORM_KEY}@1`]: defaultsDefinition() },
  submissions,
});

const replace = async (
  user: ReturnType<typeof renderShopping>["user"],
  name: string,
  text: string,
) => {
  const box = await screen.findByRole("textbox", { name });
  await user.clear(box);
  await user.type(box, text);
};

describe("表單模組:欄位預設值與日期時間", () => {
  it("新增:一打開就填預設值;沒碰過的預算跟著單價重算,碰過就停;存草稿帶 touched", async () => {
    const { user, world } = renderShopping({
      path: CREATE_PATH,
      world: worldWith(),
    });

    expect(await screen.findByRole("textbox", { name: "數量" })).toHaveValue(
      "2",
    );
    await user.type(screen.getByRole("textbox", { name: "單價" }), "40");
    expect(screen.getByRole("textbox", { name: "預算" })).toHaveValue("80");

    // 使用者改了預算 → 之後單價再變也不重算
    await replace(user, "預算", "50");
    await replace(user, "單價", "30");
    expect(screen.getByRole("textbox", { name: "預算" })).toHaveValue("50");

    await user.click(screen.getByRole("button", { name: "存草稿" }));
    await waitFor(() => {
      expect(world.inputs.createFormDraft).toHaveLength(1);
    });
    const [input] = world.inputs.createFormDraft;
    expect(input.values).toMatchObject({
      qty: "2",
      unit_price: "30",
      budget: "50",
    });
    expect(input.touched).toEqual(
      expect.arrayContaining(["unit_price", "budget"]),
    );
    expect(input.touched).not.toContain("qty");
  });

  it("編輯還沒送出的草稿:touched 裡的欄位不重算、其他照算;存草稿送回 touched", async () => {
    const { user, world } = renderShopping({
      path: EDIT_PATH,
      world: worldWith([
        submissionFragment({
          status: FormSubmissionStatus.Draft,
          revision: 0,
          revisions: [],
          summary: null,
          submittedAt: null,
          ctx: null,
          values: { item: "牛奶", qty: "2", unit_price: "40", budget: "80" },
          touched: ["budget"],
          abilities: EDITABLE,
        }),
      ]),
    });

    await replace(user, "數量", "3");
    expect(screen.getByRole("textbox", { name: "預算" })).toHaveValue("80");

    await user.click(screen.getByRole("button", { name: "存草稿" }));
    await waitFor(() => {
      expect(world.inputs.saveFormDraft).toHaveLength(1);
    });
    expect(world.inputs.saveFormDraft[0]?.touched).toEqual(
      expect.arrayContaining(["budget", "qty"]),
    );
  });

  it("日期時間欄:以租戶時區(台北)輸入與顯示,存 UTC", async () => {
    const { user, world } = renderShopping({
      path: EDIT_PATH,
      world: worldWith([
        submissionFragment({
          status: FormSubmissionStatus.Draft,
          revision: 0,
          revisions: [],
          summary: null,
          submittedAt: null,
          ctx: null,
          values: { item: "牛奶", deliver_at: "2026-03-01T01:30:00Z" },
          abilities: EDITABLE,
        }),
      ]),
    });

    const picker = await screen.findByRole("group", { name: "送達時間" });
    expect(picker).toHaveTextContent("2026-03-01 09:30");
    // MUI X 的日曆按鈕在轉場中是 pointer-events: none,以 fireEvent 點(同 ui 的 DateTimePicker 測試)
    fireEvent.click(screen.getByRole("button", { name: /choose date/i }));
    fireEvent.click(await screen.findByRole("gridcell", { name: "15" }));
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "存草稿" }));
    await waitFor(() => {
      expect(world.inputs.saveFormDraft).toHaveLength(1);
    });
    expect(world.inputs.saveFormDraft[0]?.values).toMatchObject({
      deliver_at: "2026-03-15T01:30:00Z",
    });
  });

  it("詳情:日期時間以那一筆的時區依語系格式化", async () => {
    renderShopping({
      path: VIEW_PATH,
      world: worldWith([
        submissionFragment({
          values: { item: "牛奶", deliver_at: "2026-03-01T01:30:00Z" },
        }),
      ]),
    });

    const label = await screen.findByText("送達時間");
    const cell = label.parentElement ?? document.body;
    expect(within(cell).getByText(/9:30/)).toBeInTheDocument();
    expect(within(cell).queryByText("2026-03-01T01:30:00Z")).toBeNull();
  });
});
