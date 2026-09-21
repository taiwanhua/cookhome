import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { ROLE_MANAGER_PERMISSIONS } from "./role-manager-permissions";
import { ALL_PERMISSIONS, renderRolePage } from "./role-manager-test-support";

const openUsersTab = async (
  options: Parameters<typeof renderRolePage>[0] = {},
) => {
  const rendered = renderRolePage(options);
  await screen.findByText("內容編輯 — 權限設定");
  await rendered.user.click(screen.getByRole("tab", { name: "分配使用者" }));
  await screen.findByText("內容編輯 — 分配使用者");
  return rendered;
};

describe("角色管理:分配使用者頁籤", () => {
  it("清單標示「組織外」與擁有者保護,受保護的那位不能移除", async () => {
    await openUsersTab();

    const outsider = await screen.findByRole("row", { name: /外組同事/ });
    expect(within(outsider).getByText("組織外")).toBeInTheDocument();

    const owner = screen.getByRole("row", { name: /何家華/ });
    expect(within(owner).getByText("擁有者保護")).toBeInTheDocument();
    expect(within(owner).getByRole("button", { name: "移除" })).toBeDisabled();
  });

  it("加入使用者:候選來自角色擁有組織的子樹,送出帶勾選的人", async () => {
    const { user: actor, fake } = await openUsersTab();

    await actor.click(screen.getByRole("button", { name: "加入使用者" }));
    // #261 的 7:候選改問「管理範圍內的全部使用者」(不再帶 orgId 只問子樹),
    // 資格由前端依組織樹逐列判斷、不合格的顯示但 disabled
    await waitFor(() => {
      expect(fake.inputs.users.at(-1)?.orgId).toBeUndefined();
    });
    expect(
      screen.getByText(/僅列出屬於「租戶 A」或其下層組織/),
    ).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    await actor.click(within(dialog).getByRole("checkbox", { name: /新同事/ }));
    expect(within(dialog).getByText("已選 1 人")).toBeInTheDocument();
    await actor.click(within(dialog).getByRole("button", { name: "加入" }));

    await waitFor(() => {
      expect(fake.inputs.grantRoleUsers.at(-1)).toEqual({
        roleId: "role-editor",
        userIds: ["user-new"],
      });
    });
    expect(await screen.findByText("新同事")).toBeInTheDocument();
  });

  it("加入使用者:角色擁有組織子樹外的人顯示但勾不動,並就地說明原因(#261 的 7)", async () => {
    const { user: actor } = await openUsersTab();

    await actor.click(screen.getByRole("button", { name: "加入使用者" }));
    const dialog = await screen.findByRole("dialog");

    // 不是「不列出來」,而是列出來、灰掉、講原因
    const outsider = await within(dialog).findByRole("checkbox", {
      name: /別家同事/,
    });
    expect(outsider).toBeDisabled();
    expect(
      within(dialog).getByText(
        "此使用者不在角色擁有組織之下(租戶 A),無法加入。",
      ),
    ).toBeInTheDocument();

    // 子樹內的人照樣勾得動
    expect(
      within(dialog).getByRole("checkbox", { name: /新同事/ }),
    ).toBeEnabled();
  });

  it("移除:成功後清單少一列", async () => {
    const { user: actor, fake } = await openUsersTab();

    const row = await screen.findByRole("row", { name: /王小明/ });
    await actor.click(within(row).getByRole("button", { name: "移除" }));

    await waitFor(() => {
      expect(fake.inputs.revokeRoleUsers.at(-1)).toEqual({
        roleId: "role-editor",
        userIds: ["user-ming"],
      });
    });
    await waitFor(() => {
      expect(screen.queryByText("王小明")).not.toBeInTheDocument();
    });
  });

  it("移除被擁有者保護擋下時顯示原因", async () => {
    const { user: actor } = await openUsersTab({
      world: { failures: { RevokeRoleUsers: { code: "OWNER_PROTECTED" } } },
    });

    const row = await screen.findByRole("row", { name: /王小明/ });
    await actor.click(within(row).getByRole("button", { name: "移除" }));

    expect(
      await screen.findByText("頂層組織的擁有者受保護,這個動作被拒絕。"),
    ).toBeInTheDocument();
  });

  it("沒有 assign-users 權限時,加入與移除都不出現", async () => {
    await openUsersTab({
      permissions: ALL_PERMISSIONS.filter(
        (key) => key !== ROLE_MANAGER_PERMISSIONS.assignUsers,
      ),
    });

    expect(
      screen.queryByRole("button", { name: "加入使用者" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "移除" }),
    ).not.toBeInTheDocument();
  });
});
