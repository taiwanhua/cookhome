import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { ROLE_MANAGER_PERMISSIONS } from "./role-manager-permissions";
import { ALL_PERMISSIONS, renderRolePage } from "./role-manager-test-support";

describe("角色管理頁(/system/role-manager)", () => {
  it("清單顯示角色與標籤,預設選中第一筆,搜尋送出關鍵字", async () => {
    const { user: actor, fake } = renderRolePage();

    expect(await screen.findByText("內容編輯")).toBeInTheDocument();
    expect(screen.getByText("系統內建")).toBeInTheDocument();
    expect(screen.getByText("預設角色")).toBeInTheDocument();
    expect(screen.getByText("租戶 A · 持有 2 人")).toBeInTheDocument();
    // 預設選中第一筆 → 右邊直接是它的權限設定
    expect(await screen.findByText("內容編輯 — 權限設定")).toBeInTheDocument();

    await actor.type(screen.getByLabelText("搜尋"), "審核");
    await waitFor(() => {
      expect(fake.inputs.roles.at(-1)?.keyword).toBe("審核");
    });
  });

  it("新增角色:擁有組織預設當前組織、欄位下有固定提示,送出帶擁有組織", async () => {
    const { user: actor, fake } = renderRolePage();

    await screen.findByText("內容編輯");
    await actor.click(screen.getByRole("button", { name: "+ 新增" }));

    expect(
      screen.getByText("這個角色的持有者可以管理此組織與它底下的所有組織"),
    ).toBeInTheDocument();

    await actor.type(screen.getByLabelText("名稱"), "南港店管理員");
    await actor.click(screen.getByRole("button", { name: "新增" }));

    await waitFor(() => {
      expect(fake.inputs.createRole.at(-1)).toEqual({
        name: "南港店管理員",
        description: null,
        ownerOrgId: "org-tenant",
      });
    });
  });

  it("編輯角色:擁有組織唯讀,送出只帶名稱與描述", async () => {
    const { user: actor, fake } = renderRolePage();

    await screen.findByText("內容編輯");
    await actor.click(screen.getByRole("button", { name: "編輯" }));

    expect(screen.getByLabelText("擁有組織")).toBeDisabled();

    await actor.clear(screen.getByLabelText("名稱"));
    await actor.type(screen.getByLabelText("名稱"), "內容編輯 2");
    await actor.click(screen.getByRole("button", { name: "儲存" }));

    await waitFor(() => {
      expect(fake.inputs.updateRole.at(-1)).toEqual({
        id: "role-editor",
        name: "內容編輯 2",
        description: "內容管理相關權限",
      });
    });
  });

  it("刪除前置不過:逐項列出原因並提示改用停用", async () => {
    const { user: actor } = renderRolePage({
      world: {
        failures: {
          DeleteRole: {
            code: "ROLE_NOT_DELETABLE",
            reasons: ["HAS_GRANTS", "SYSTEM_ROLE"],
          },
        },
      },
    });

    await screen.findByText("內容編輯");
    await actor.click(screen.getByRole("button", { name: "刪除" }));
    const dialog = await screen.findByRole("dialog");
    await actor.click(within(dialog).getByRole("button", { name: "刪除" }));

    expect(
      await screen.findByText("還有使用者持有這個角色,請先把他們移除。"),
    ).toBeInTheDocument();
    expect(screen.getByText("這是系統內建角色。")).toBeInTheDocument();
    expect(screen.getByText(/不能刪除時可以改用「停用」/)).toBeInTheDocument();
  });

  it("停用角色:確認後送出 setRoleEnabled", async () => {
    const { user: actor, fake } = renderRolePage();

    await screen.findByText("內容編輯");
    await actor.click(screen.getByRole("button", { name: "停用" }));
    expect(await screen.findByText("停用 內容編輯?")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    await actor.click(within(dialog).getByRole("button", { name: "停用" }));

    await waitFor(() => {
      expect(fake.inputs.setRoleEnabled.at(-1)).toEqual({
        id: "role-editor",
        enabled: false,
      });
    });
  });

  it("只有檢視權限時,新增 / 編輯 / 停用 / 刪除 / 儲存 / 加入使用者都不出現", async () => {
    renderRolePage({
      permissions: ALL_PERMISSIONS.filter(
        (key) =>
          key === ROLE_MANAGER_PERMISSIONS.view ||
          !key.startsWith("system.role-manager."),
      ),
    });

    await screen.findByText("內容編輯");
    expect(
      screen.queryByRole("button", { name: "+ 新增" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "編輯" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "停用" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "刪除" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "儲存變更" }),
    ).not.toBeInTheDocument();
  });

  it("沒有檢視權限時整頁只剩提示,不送清單查詢", async () => {
    const { fake } = renderRolePage({ permissions: [] });

    expect(
      await screen.findByText("你沒有角色管理的檢視權限,看不到角色清單。"),
    ).toBeInTheDocument();
    expect(fake.inputs.roles).toHaveLength(0);
  });
});
