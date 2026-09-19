import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import {
  ORG_MANAGER_VIEW_PERMISSION,
  USER_MANAGER_PERMISSIONS,
} from "./user-manager-permissions";
import {
  ALL_PERMISSIONS,
  renderPage,
  rowOf,
} from "./user-manager-test-support";

describe("使用者管理頁(/system/user-manager)", () => {
  it("左樹選組織後清單收斂到該組織子樹,分頁換頁重查", async () => {
    const { user: actor, fake } = renderPage();

    expect(await screen.findByText("何家華")).toBeInTheDocument();
    expect(screen.getByText("共 12 筆,每頁 10 筆")).toBeInTheDocument();

    await actor.click(screen.getByRole("button", { name: "前往第 2 頁" }));
    await waitFor(() => {
      expect(fake.inputs.users.at(-1)?.page).toBe(2);
    });

    await actor.click(screen.getByText("內容組"));
    await waitFor(() => {
      expect(fake.inputs.users.at(-1)?.orgId).toBe("org-content");
    });
    expect(await screen.findByText("王小明")).toBeInTheDocument();
    expect(screen.queryByText("何家華")).not.toBeInTheDocument();
  });

  /**
   * #183 第 4 項:以前一開始沒選組織就送 `orgId: null`,api 回
   * `orgId is not a valid id: null`。現在預設選中樹根,樹還沒到手就先不查。
   */
  it("初始狀態:預設選中樹根,送出的 orgId 一律不是 null", async () => {
    const { fake } = renderPage();

    await screen.findByText("何家華");
    // 第一次查詢就帶樹根,而且從頭到尾沒有一次 orgId 是 null
    expect(fake.inputs.users[0]?.orgId).toBe("org-tenant");
    expect(fake.inputs.users.every((input) => input.orgId !== null)).toBe(true);
  });

  it("沒有組織樹權限時不給 orgId(攤開整個可見範圍),清單照樣查得到", async () => {
    const { fake } = renderPage({
      permissions: ALL_PERMISSIONS.filter(
        (key) => key !== ORG_MANAGER_VIEW_PERMISSION,
      ),
    });

    await screen.findByText("何家華");
    expect(fake.inputs.users[0]?.orgId).toBeUndefined();
  });

  it("角色欄以「組織外」標示失去組織支撐的授予,所屬組織多筆時收成 +N", async () => {
    renderPage();

    const row = await screen.findByRole("row", { name: /王小明/ });
    expect(within(row).getByText("組織外")).toBeInTheDocument();
    expect(within(row).getByText("+1")).toBeInTheDocument();
  });

  it("擁有者的停用動作 disabled 並提示,其他人正常", async () => {
    renderPage();

    await screen.findByText("何家華");
    // 擁有者由 `org(樹根)` 的 ownerUserId 決定,那是第二個查詢,可能比清單晚回來
    await waitFor(() => {
      expect(
        within(rowOf("何家華")).getByRole("button", { name: "停用" }),
      ).toBeDisabled();
    });
    expect(
      within(rowOf("王小明")).getByRole("button", { name: "停用" }),
    ).toBeEnabled();
  });

  it("新增使用者:選「直接設定初始密碼」才出現密碼欄,送出帶啟用方式與所屬組織", async () => {
    const { user: actor, fake } = renderPage();

    await screen.findByText("何家華");
    await actor.click(screen.getByText("內容組"));
    await actor.click(screen.getByRole("button", { name: "新增使用者" }));

    expect(await screen.findByLabelText("登入帳號 *")).toBeInTheDocument();
    expect(screen.queryByLabelText("初始密碼 *")).not.toBeInTheDocument();

    await actor.click(screen.getByRole("radio", { name: /直接設定初始密碼/ }));
    const password = await screen.findByLabelText("初始密碼 *");

    await actor.type(screen.getByLabelText("登入帳號 *"), "newbie");
    await actor.type(screen.getByLabelText("姓名 *"), "新人");
    await actor.type(
      screen.getByLabelText("Email *"),
      "newbie@cookhome.online",
    );
    await actor.type(password, "secret-1234");
    await actor.click(screen.getByRole("button", { name: "新增" }));

    await waitFor(() => {
      expect(fake.inputs.createUser).toHaveLength(1);
    });
    const input = fake.inputs.createUser[0];
    expect(input.activation.mode).toBe("PASSWORD");
    expect(input.activation.initialPassword).toBe("secret-1234");
    expect(input.orgIds).toEqual(["org-content"]);
  });

  it("身分證欄依欄位級權限出現:有 show-national-id 才在編輯彈窗看得到", async () => {
    const { user: actor } = renderPage();

    await screen.findByText("王小明");
    await actor.click(
      within(rowOf("王小明")).getByRole("button", { name: "編輯" }),
    );

    expect(await screen.findByLabelText("身分證(選填)")).toHaveValue(
      "A123456789",
    );
  });

  it("沒有 show-national-id 時編輯彈窗不渲染身分證欄", async () => {
    const { user: actor } = renderPage({
      permissions: ALL_PERMISSIONS.filter(
        (key) => key !== USER_MANAGER_PERMISSIONS.showNationalId,
      ),
    });

    await screen.findByText("王小明");
    await actor.click(
      within(rowOf("王小明")).getByRole("button", { name: "編輯" }),
    );

    expect(await screen.findByLabelText("登入帳號 *")).toBeInTheDocument();
    expect(screen.queryByLabelText("身分證(選填)")).not.toBeInTheDocument();
  });

  it("移除所屬組織:先 dry-run 顯示失去資格清單,三檔預設 (c),確認後才正式送出", async () => {
    const { user: actor, fake } = renderPage({
      world: {
        dryRun: {
          removedOrgs: [{ id: "org-content", name: "內容組" }],
          unqualifiedRoles: [
            {
              roleId: "role-editor",
              roleName: "編輯",
              ownerOrgId: "org-content",
              ownerOrgName: "內容組",
              reasons: ["OWNED_BY_REMOVED_ORG"],
              ownerProtected: false,
            },
            {
              roleId: "role-audit",
              roleName: "審核員",
              ownerOrgId: "org-tenant",
              ownerOrgName: "租戶 A",
              reasons: ["NO_REMAINING_SUBTREE_SUPPORT"],
              ownerProtected: false,
            },
          ],
        },
      },
    });

    await screen.findByText("王小明");
    await actor.click(
      within(rowOf("王小明")).getByRole("button", { name: "所屬組織" }),
    );

    const treeItems = await screen.findAllByRole("treeitem");
    const contentItem = treeItems.find((item) => item.textContent === "內容組");
    const checkbox = contentItem?.querySelector("input[type='checkbox']");
    if (!(checkbox instanceof HTMLElement)) {
      throw new TypeError("找不到「內容組」的核取方塊");
    }
    await actor.click(checkbox);
    await actor.click(screen.getByRole("button", { name: "確定" }));

    expect(await screen.findByText("確認所屬組織變更?")).toBeInTheDocument();
    expect(fake.inputs.setUserOrgs[0]?.dryRun).toBe(true);
    expect(screen.getByText("移除:內容組")).toBeInTheDocument();
    expect(screen.getByText("由被移除的組織擁有")).toBeInTheDocument();
    expect(
      screen.getByText("剩餘的所屬組織都不在該角色的擁有組織底下"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /解除所有因此失去資格的角色/ }),
    ).toBeChecked();

    await actor.click(screen.getByRole("button", { name: "確認變更" }));
    await waitFor(() => {
      expect(fake.inputs.setUserOrgs).toHaveLength(2);
    });
    expect(fake.inputs.setUserOrgs[1]).toMatchObject({
      userId: "user-ming",
      dryRun: false,
      removalPolicy: "REVOKE_ALL_UNQUALIFIED",
      orgIds: ["org-tenant"],
    });
  });

  it("停用彈窗確認後送出,api 回 OWNER_PROTECTED 時顯示原因", async () => {
    const { user: actor, fake } = renderPage({
      world: { failures: { SetUserEnabled: "OWNER_PROTECTED" } },
    });

    await screen.findByText("王小明");
    await actor.click(
      within(rowOf("王小明")).getByRole("button", { name: "停用" }),
    );
    await actor.click(
      screen.getByRole("button", { name: "停用", hidden: false }),
    );

    await waitFor(() => {
      expect(fake.inputs.setUserEnabled).toHaveLength(1);
    });
    expect(fake.inputs.setUserEnabled[0]).toEqual({
      id: "user-ming",
      enabled: false,
    });
    expect(
      await screen.findByText("頂層組織的擁有者受保護,這個動作被拒絕。"),
    ).toBeInTheDocument();
  });

  it("沒有 create 權限時不顯示新增按鈕", async () => {
    renderPage({
      permissions: ALL_PERMISSIONS.filter(
        (key) => key !== USER_MANAGER_PERMISSIONS.create,
      ),
    });

    await screen.findByText("何家華");
    expect(
      screen.queryByRole("button", { name: "新增使用者" }),
    ).not.toBeInTheDocument();
  });
});
