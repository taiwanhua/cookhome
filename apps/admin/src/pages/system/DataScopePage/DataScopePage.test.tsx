import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { savedRule } from "@/test/msw/data-scope-fixtures";

import { DATA_SCOPE_PERMISSIONS } from "./data-scope-permissions";
import {
  editor,
  renderPage,
  targetList,
  waitForEditor,
} from "./data-scope-test-support";

describe("資料範圍頁(/system/data-scope)", () => {
  it("左清單列出種子宣告的資料目標,已經設過規則的掛「已設規則」;預設選第一個", async () => {
    renderPage({ world: { rules: [savedRule] } });

    await waitForEditor("示範項目(demo_items_one)");

    const items = within(targetList()).getAllByRole("button");
    expect(items[0]).toHaveTextContent("示範項目");
    expect(items[0]).toHaveTextContent("demo_items_one");
    expect(items[0]).toHaveTextContent("已設規則");
    // 第二個目標還沒有規則,不掛標籤
    expect(items[1]).toHaveTextContent("示範項目2");
    expect(items[1]).not.toHaveTextContent("已設規則");
  });

  it("右邊一定看得到「沒有規則 = 可見範圍內」的預設提示與保底說明", async () => {
    renderPage();

    await waitForEditor("示範項目(demo_items_one)");
    expect(
      within(editor()).getByText(/未命中任何規則的人 → 預設:可見範圍內/),
    ).toBeInTheDocument();
    expect(
      within(editor()).getByText(
        "目前沒有規則:每個人都看得到自己可見範圍內的全部資料。",
      ),
    ).toBeInTheDocument();
  });

  it("已存在的規則讀回編輯器:頂層合成、套用對象與巢狀群組都還原", async () => {
    renderPage({ world: { rules: [savedRule] } });

    await waitForEditor("示範項目(demo_items_one)");

    expect(
      within(editor()).getByRole("combobox", { name: "規則合成" }),
    ).toHaveTextContent("OR — 命中任一規則即可(資料變多)");
    expect(
      within(editor()).getByRole("combobox", { name: "套用對象" }),
    ).toHaveTextContent("角色");
    expect(
      within(editor()).getByRole("combobox", { name: "對象" }),
    ).toHaveTextContent("客服");
    // 規則 1 的條件樹:根群組 AND + 一個 OR 子群組
    expect(
      within(editor()).getByRole("combobox", { name: "條件組合" }),
    ).toHaveTextContent("AND — 全部成立才放行");
    expect(
      within(editor()).getByRole("combobox", { name: "群組組合" }),
    ).toHaveTextContent("OR — 其中一個成立即可");
    expect(
      within(editor()).getByText("整個群組視為上一層的一個條件"),
    ).toBeInTheDocument();
  });

  it("切換資料目標會換成那個目標的規則", async () => {
    const { user: actor } = renderPage({ world: { rules: [savedRule] } });

    await waitForEditor("示範項目(demo_items_one)");
    await actor.click(
      within(targetList()).getByRole("button", { name: /示範項目2/ }),
    );

    await waitForEditor("示範項目2(demo_items_two)");
    expect(
      within(editor()).queryByRole("combobox", { name: "套用對象" }),
    ).not.toBeInTheDocument();
  });

  it("有未儲存的變更時切目標要先確認;「繼續編輯」留在原地,「放棄變更」才切過去", async () => {
    const { user: actor } = renderPage();

    await waitForEditor("示範項目(demo_items_one)");
    await actor.click(screen.getByRole("button", { name: "+ 新增規則" }));
    await actor.click(
      within(targetList()).getByRole("button", { name: /示範項目2/ }),
    );

    expect(
      await screen.findByText("放棄未儲存的變更?"),
    ).toBeInTheDocument();
    await actor.click(screen.getByRole("button", { name: "繼續編輯" }));
    await waitFor(() => {
      expect(screen.queryByText("放棄未儲存的變更?")).not.toBeInTheDocument();
    });
    expect(
      within(editor()).getByText("示範項目(demo_items_one)"),
    ).toBeInTheDocument();

    await actor.click(
      within(targetList()).getByRole("button", { name: /示範項目2/ }),
    );
    await actor.click(
      await screen.findByRole("button", { name: "放棄變更" }),
    );

    await waitForEditor("示範項目2(demo_items_two)");
  });

  it("只有檢視權限時,編輯器唯讀:新增 / 刪除 / 儲存都不出現", async () => {
    renderPage({
      permissions: [DATA_SCOPE_PERMISSIONS.view],
      world: { rules: [savedRule] },
    });

    await waitForEditor("示範項目(demo_items_one)");
    for (const label of ["+ 新增規則", "刪除規則", "+ 條件", "+ 群組", "儲存"]) {
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
    }
    expect(
      within(editor()).getByRole("combobox", { name: "規則合成" }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});
