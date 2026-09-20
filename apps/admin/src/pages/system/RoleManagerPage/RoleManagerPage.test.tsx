import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { RoleKind } from "@repo/graphql";

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

    // 「內容編輯」已有人持有 ⇒ `abilities.canDelete` 為 false、列上沒有刪除鍵(#261);
    // 要驗這個彈窗得挑一個列得出刪除鍵的角色(審核員:自建、無人持有)
    await screen.findByText("內容編輯");
    await actor.click(screen.getByText("審核員"));
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

  /**
   * 列上的動作 = 操作者的權限 × 這個角色的 `abilities`(#261;種類規則由 api 算)。
   * 夾具的 `abilities` 照 api 的規則表推,見 `test/msw/role-fixtures.ts`。
   */
  describe("角色種類規則:動作按鈕讀 abilities(#261)", () => {
    it("種子角色:沒有編輯 / 停用 / 刪除,矩陣唯讀並說明內容隨版本更新", async () => {
      const { user: actor } = renderRolePage();

      await screen.findByText("內容編輯");
      await actor.click(screen.getByText("超級管理員"));

      expect(
        screen.queryByRole("button", { name: "編輯" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "停用" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "刪除" }),
      ).not.toBeInTheDocument();
      // 矩陣唯讀:沒有儲存鍵,並標一句為什麼
      expect(
        screen.queryByRole("button", { name: "儲存變更" }),
      ).not.toBeInTheDocument();
      expect(
        await screen.findByText("系統內建角色,內容隨版本更新,這裡只能檢視。"),
      ).toBeInTheDocument();
    });

    it("預設角色:改得動、刪不掉;非 root 停不掉(canToggleEnabled = false)", async () => {
      const { user: actor } = renderRolePage();

      await screen.findByText("內容編輯");
      await actor.click(screen.getByText("租戶管理員"));

      expect(screen.getByRole("button", { name: "編輯" })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "停用" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "刪除" }),
      ).not.toBeInTheDocument();
    });

    it("root 視角:api 把預設角色的 canToggleEnabled 算成 true,列上就出現停用", async () => {
      const { user: actor } = renderRolePage({
        world: {
          roles: [
            {
              id: "role-admin",
              name: "租戶管理員",
              description: "租戶內全部模組",
              enabled: true,
              kind: RoleKind.TemplateCopy,
              abilities: {
                canEdit: true,
                canEditMatrix: true,
                // root 視角:預設角色停得掉
                canToggleEnabled: true,
                canDelete: false,
              },
              isSystem: false,
              isTemplateCopy: true,
              userCount: 1,
              ownerOrg: {
                id: "org-tenant",
                name: "租戶 A",
                tenantTop: { id: "org-tenant", name: "租戶 A" },
              },
            },
          ],
        },
      });

      await screen.findByText("租戶管理員");
      await actor.click(screen.getByText("租戶管理員"));
      expect(screen.getByRole("button", { name: "停用" })).toBeInTheDocument();
    });

    it("自鎖:操作者自己持有的角色,api 回 canToggleEnabled = false,沒有停用鍵", async () => {
      const { user: actor } = renderRolePage({
        world: {
          roles: [
            {
              id: "role-editor",
              name: "內容編輯",
              description: null,
              enabled: true,
              kind: RoleKind.Custom,
              abilities: {
                canEdit: true,
                canEditMatrix: true,
                // 操作者自己正持有它 → 停用會把自己鎖在外面
                canToggleEnabled: false,
                canDelete: false,
              },
              isSystem: false,
              isTemplateCopy: false,
              userCount: 1,
              ownerOrg: {
                id: "org-tenant",
                name: "租戶 A",
                tenantTop: { id: "org-tenant", name: "租戶 A" },
              },
            },
          ],
        },
      });

      await screen.findByText("內容編輯");
      await actor.click(screen.getByText("內容編輯"));
      expect(screen.getByRole("button", { name: "編輯" })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "停用" }),
      ).not.toBeInTheDocument();
    });

    it("根組織視角:清單依租戶頂層分組,標題是租戶名稱", async () => {
      renderRolePage({
        world: {
          roles: [
            {
              id: "role-admin-a",
              name: "租戶管理員",
              description: null,
              enabled: true,
              kind: RoleKind.TemplateCopy,
              abilities: {
                canEdit: true,
                canEditMatrix: true,
                canToggleEnabled: true,
                canDelete: false,
              },
              isSystem: false,
              isTemplateCopy: true,
              userCount: 1,
              ownerOrg: {
                id: "org-tenant",
                name: "租戶 A",
                tenantTop: { id: "org-tenant", name: "租戶 A" },
              },
            },
            {
              id: "role-admin-b",
              name: "租戶管理員",
              description: null,
              enabled: true,
              kind: RoleKind.TemplateCopy,
              abilities: {
                canEdit: true,
                canEditMatrix: true,
                canToggleEnabled: true,
                canDelete: false,
              },
              isSystem: false,
              isTemplateCopy: true,
              userCount: 1,
              ownerOrg: {
                id: "org-tenant-b",
                name: "租戶 B",
                tenantTop: { id: "org-tenant-b", name: "租戶 B" },
              },
            },
          ],
        },
      });

      // 兩筆同名角色靠租戶分組與「擁有組織」那一行分辨(#261 的 8)
      await screen.findAllByText("租戶管理員");
      expect(await screen.findByText("租戶 A · 持有 1 人")).toBeInTheDocument();
      expect(screen.getByText("租戶 B · 持有 1 人")).toBeInTheDocument();
    });
  });
});
