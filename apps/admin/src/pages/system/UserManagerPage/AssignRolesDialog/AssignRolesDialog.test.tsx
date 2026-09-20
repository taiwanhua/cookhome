import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { renderPage, rowOf } from "../user-manager-test-support";

/**
 * 指派角色彈窗(#211:候選改用正式的 `roles` query,擁有組織在操作者管理範圍內;
 * 第 3 段「查操作者自己持有的角色」的過渡做法退場)。
 */
describe("指派角色彈窗", () => {
  it("指派角色:候選來自 roles query,停用不可勾、租戶副本標記、範圍外的既有授予唯讀", async () => {
    const { user: actor, fake } = renderPage();

    await screen.findByText("王小明");
    await actor.click(
      within(rowOf("王小明")).getByRole("button", { name: "指派角色" }),
    );

    // 候選是 `roles` 回的清單(擁有組織在管理範圍內),不再是「操作者自己持有的角色」
    await waitFor(() => {
      expect(fake.inputs.roles).toHaveLength(1);
    });

    // 每列標「角色名稱 — 擁有組織」(#261 的 8:根組織視角靠這一段分辨同名角色)
    const editor = await screen.findByRole("checkbox", {
      name: "編輯 — 租戶 A",
    });
    expect(editor).toBeChecked();
    expect(editor).toBeEnabled();
    // 三筆候選的擁有組織是租戶 A(範圍外的那筆改顯示原因,不顯示擁有組織)
    expect(screen.getAllByText("擁有組織:租戶 A")).toHaveLength(3);
    expect(screen.getByText("內容管理相關權限")).toBeInTheDocument();

    // 停用的角色勾了也不生效(ADR-0011 步驟 2),所以不給新勾
    expect(
      screen.getByRole("checkbox", { name: "檢視者 — 租戶 A" }),
    ).toBeDisabled();
    expect(screen.getByText("已停用")).toBeInTheDocument();
    // 租戶副本掛標籤
    expect(screen.getByText("租戶副本")).toBeInTheDocument();

    // 已持有但擁有組織在管理範圍外:唯讀顯示,送出時也不包含
    const auditor = screen.getByRole("checkbox", { name: "審核員 — 租戶 A" });
    expect(auditor).toBeDisabled();
    expect(screen.getByText("不在你的管理範圍內,無法變更")).toBeInTheDocument();

    await actor.click(editor);
    await actor.click(screen.getByRole("button", { name: "儲存指派" }));

    await waitFor(() => {
      expect(fake.inputs.assignUserRoles).toHaveLength(1);
    });
    expect(fake.inputs.assignUserRoles[0].roleIds).toEqual([]);
  });

  it("沒有授予資格的角色顯示但勾不動,並就地說明只能授予哪個組織(#261 的 6)", async () => {
    const { user: actor } = renderPage();

    await screen.findByText("王小明");
    await actor.click(
      within(rowOf("王小明")).getByRole("button", { name: "指派角色" }),
    );

    // 「分店專員」的擁有組織是租戶 B,王小明屬租戶 A / 內容組 ⇒ 沒有資格
    const branch = await screen.findByRole("checkbox", {
      name: "分店專員 — 租戶 B",
    });
    expect(branch).toBeDisabled();
    expect(
      screen.getByText(
        "此角色只能授予 租戶 B 及其下層的使用者;王小明 不在角色擁有組織之下。",
      ),
    ).toBeInTheDocument();
  });

  it("搜尋收斂角色清單(名稱或擁有組織)", async () => {
    const { user: actor } = renderPage();

    await screen.findByText("王小明");
    await actor.click(
      within(rowOf("王小明")).getByRole("button", { name: "指派角色" }),
    );
    await screen.findByRole("checkbox", { name: "編輯 — 租戶 A" });

    await actor.type(screen.getByLabelText("搜尋角色"), "分店");
    expect(
      await screen.findByRole("checkbox", { name: "分店專員 — 租戶 B" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "編輯 — 租戶 A" }),
    ).not.toBeInTheDocument();
  });
});
