import { describe, expect, it } from "@jest/globals";
import { screen, within } from "@testing-library/react";

import type { FormDefinition } from "@repo/domain/form";

import {
  SHOPPING_FORM_KEY,
  SHOPPING_ROUTES,
  shoppingDefinition,
  submissionFragment,
} from "@/test/msw/form-fixtures";

import { renderShopping, shoppingForm } from "./form-module-test-support";

/** 「晚到提醒」只在 `ctx.now` 晚於 2026-06-01 時顯示 —— 用來驗唯讀模式用的是**那次修訂的時間**。 */
const withLateNote = (): FormDefinition => {
  const definition = shoppingDefinition();
  return {
    ...definition,
    fields: [
      ...definition.fields,
      {
        key: "late_note",
        label: "晚到提醒",
        type: "text",
        widget: { kind: "textField" },
        valueSource: { kind: "input" },
        visibleWhen: { ">": [{ now: [] }, "2026-06-01"] },
        permission: { show: false, edit: false },
      },
    ],
    layout: {
      sections: [
        ...definition.layout.sections,
        {
          key: "extra",
          title: "其他",
          rows: [{ cols: [{ fieldKey: "late_note", span: 12 }] }],
        },
      ],
    },
  };
};

const EARLY = "2026-01-05T02:00:00.000Z";

describe("表單模組詳情頁(預設組裝,FormRenderer 唯讀模式)", () => {
  it("唯讀:不重算存值、條件用該修訂的 ctx、看不到的欄位不渲染、頁籤套摘要標題", async () => {
    renderShopping({
      path: `${SHOPPING_ROUTES.viewPage}/sub-1`,
      world: {
        moduleForms: [shoppingForm],
        versions: { [`${SHOPPING_FORM_KEY}@1`]: withLateNote() },
        submissions: [
          submissionFragment({
            // 存下的總價是 999(不是 2 × 30):唯讀模式照存值顯示,不重算
            values: {
              item: "雞蛋",
              qty: "2",
              unit_price: "30",
              total: "999",
              note: "要放山",
              late_note: "晚點到",
              internal_note: "[redacted]",
            },
            fieldStates: [
              {
                key: "internal_note",
                visible: true,
                readonly: true,
                redacted: true,
              },
            ],
            ctx: {
              at: EARLY,
              timezone: "Asia/Taipei",
              userId: "user-1",
              orgId: "org-1",
            },
          }),
        ],
      },
    });

    expect(
      await screen.findByRole("heading", { name: "雞蛋" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("999 元")).toBeInTheDocument();
    expect(screen.getByText("要放山")).toBeInTheDocument();
    // 修訂的 ctx.now = 2026-01-05,條件「晚於 2026-06-01」不成立 → 不顯示(即使讀者的現在已晚於它)
    expect(screen.queryByText("晚到提醒")).toBeNull();
    // 受保護且讀者沒有 show:整格不渲染(不是顯示空值)
    expect(screen.queryByText("內部備註")).toBeNull();
    const tabs = screen.getByRole("tablist", { name: "路由頁籤" });
    expect(await within(tabs).findByText(/雞蛋/)).toBeInTheDocument();
  });

  it("修訂紀錄:看得到每個修訂,與前一修訂的差異由相鄰兩份快照算", async () => {
    const { user } = renderShopping({
      path: `${SHOPPING_ROUTES.viewPage}/sub-1`,
      world: {
        moduleForms: [shoppingForm],
        versions: { [`${SHOPPING_FORM_KEY}@1`]: shoppingDefinition() },
        submissions: [
          submissionFragment({
            revision: 2,
            revisions: [
              { revision: 1, at: EARLY, user: { id: "user-1", name: "小華" } },
              { revision: 2, at: EARLY, user: { id: "user-2", name: "阿明" } },
            ],
          }),
        ],
        snapshots: {
          "sub-1": {
            1: { item: "雞蛋", qty: "1", unit_price: "30", total: "30" },
            2: { item: "雞蛋", qty: "2", unit_price: "30", total: "60" },
          },
        },
      },
    });

    const history = await screen.findByRole("region", { name: "修訂紀錄" });
    expect(within(history).getByText(/修訂 2 · 阿明/)).toBeInTheDocument();

    await user.click(
      within(history).getByRole("button", { name: "與前一修訂的差異" }),
    );

    const diff = await within(history).findByRole("table", {
      name: "修訂 2 的差異",
    });
    expect(within(diff).getByText("數量")).toBeInTheDocument();
    expect(within(diff).getByText("總價")).toBeInTheDocument();
    expect(within(diff).queryByText("品項")).toBeNull();
  });

  it("頁籤模板的系統佔位符:{{form}} = 表單名、{{applicant}} = 建立者現名", async () => {
    renderShopping({
      path: `${SHOPPING_ROUTES.viewPage}/sub-1`,
      world: {
        moduleForms: [
          { ...shoppingForm, tabLabelTemplate: "{{form}} — {{applicant}}" },
        ],
        versions: { [`${SHOPPING_FORM_KEY}@1`]: shoppingDefinition() },
        submissions: [submissionFragment()],
      },
    });

    const tabs = await screen.findByRole("tablist", { name: "路由頁籤" });
    expect(await within(tabs).findByText(/購物單 — 小華/)).toBeInTheDocument();
  });
});
