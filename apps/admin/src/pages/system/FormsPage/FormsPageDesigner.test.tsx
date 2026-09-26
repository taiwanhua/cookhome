import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import {
  findDesigner,
  preloadFormsPage,
  renderFormsPage,
  smallDesignOptions,
} from "./forms-page-test-support";

preloadFormsPage();

const canvas = () => screen.getByRole("region", { name: "畫布" });

describe("表單管理:設計器", () => {
  it("從元件面板加欄位、改顯示名稱、存草稿帶 expectedDraftRevision", async () => {
    const { user, world } = renderFormsPage(smallDesignOptions());
    const palette = await findDesigner();

    await user.click(
      within(palette).getByRole("button", { name: "新增單行文字欄位" }),
    );
    const label = await screen.findByRole("textbox", { name: "顯示名稱" });
    await user.clear(label);
    await user.type(label, "店家");
    await user.click(screen.getByRole("button", { name: "存草稿" }));

    await waitFor(() => {
      expect(world.inputs.saveFormVersionDraft).toHaveLength(1);
    });
    const saved = world.inputs.saveFormVersionDraft[0];
    expect(saved.expectedDraftRevision).toBe(1);
    expect(saved.fields).toContainEqual(
      expect.objectContaining({ key: "field_1", label: "店家", type: "text" }),
    );
    // 存完基準換成新的修訂號,再存一次帶的是 2
    expect(await screen.findByText("草稿修訂 2")).toBeInTheDocument();
  });

  it("草稿已被別人改過(409)→ 提示重新載入", async () => {
    const { user } = renderFormsPage({
      ...smallDesignOptions(),
      failures: {
        SaveFormVersionDraft: {
          code: "CONFLICT",
          extensions: { reason: "DRAFT_REVISION_MISMATCH" },
        },
      },
    });
    const palette = await findDesigner();

    await user.click(
      within(palette).getByRole("button", { name: "新增數字欄位" }),
    );
    await user.click(screen.getByRole("button", { name: "存草稿" }));

    expect(
      await screen.findByText("草稿已被別人更新,請重新載入。"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "重新載入" }),
    ).toBeInTheDocument();
  });

  it("設計模式只標示、不跑條件與計算;預覽模式條件與計算即時跑", async () => {
    const { user } = renderFormsPage();
    await findDesigner();

    // 設計模式:備註有顯示條件也照樣畫出來,並標示;計算欄位標「計算欄位」
    const note = within(canvas()).getByRole("button", {
      name: "選取欄位「備註」(note)",
    });
    expect(within(note).getByText("有顯示條件")).toBeInTheDocument();
    const total = within(canvas()).getByRole("button", {
      name: "選取欄位「總價」(total)",
    });
    expect(within(total).getByText("計算欄位")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "預覽" }));
    const preview = await screen.findByRole("region", { name: "預覽" });
    expect(within(preview).queryByRole("textbox", { name: "備註" })).toBeNull();

    await user.type(
      within(preview).getByRole("textbox", { name: "數量" }),
      "2",
    );
    await user.type(
      within(preview).getByRole("textbox", { name: "單價" }),
      "15",
    );

    expect(
      await within(preview).findByDisplayValue("30 元"),
    ).toBeInTheDocument();
    expect(
      within(preview).getByRole("textbox", { name: "備註" }),
    ).toBeInTheDocument();
  });

  it("刪被引用的欄位:先列出引用處、確認後只從草稿移除,引用處變成檢查器錯誤", async () => {
    const { user, world } = renderFormsPage();
    await findDesigner();

    await user.click(
      within(canvas()).getByRole("button", { name: "選取欄位「數量」(qty)" }),
    );
    await user.click(await screen.findByRole("button", { name: "刪除欄位" }));

    const dialog = await screen.findByRole("dialog", {
      name: "刪除欄位「數量」?",
    });
    const references = within(dialog).getByRole("list", {
      name: "引用這個欄位的地方",
    });
    expect(
      within(references).getByText("欄位 total 的公式"),
    ).toBeInTheDocument();
    expect(
      within(references).getByText("欄位 note 的顯示條件"),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "刪除" }));

    expect(
      within(canvas()).queryByRole("button", { name: "選取欄位「數量」(qty)" }),
    ).toBeNull();
    const issues = screen.getByRole("region", { name: "檢查結果" });
    expect(
      within(issues).getAllByText(/EXPR_UNKNOWN_FIELD/).length,
    ).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "存草稿" }));
    await waitFor(() => {
      expect(world.inputs.saveFormVersionDraft).toHaveLength(1);
    });
    const fields = world.inputs.saveFormVersionDraft[0]?.fields ?? [];
    expect(fields.map((field) => field.key)).not.toContain("qty");
    // 公式不自動改:總價仍引用 qty,由設計者手動修
    expect(fields.find((field) => field.key === "total")).toMatchObject({
      valueSource: {
        kind: "computed",
        expr: { "*": [{ var: "qty" }, { var: "unit_price" }] },
      },
    });
  });
});
