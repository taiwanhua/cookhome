import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import {
  FormVersionStatus,
  ModuleEngine,
  ModuleListColumnKind,
  ModuleSidebarType,
} from "@repo/graphql";

import { authWorld } from "@/test/msw/auth-handlers";
import { formDesignWorld } from "@/test/msw/form-design-handlers";
import {
  SHOPPING_FORM_KEY,
  formFragment,
  shoppingDefinition,
  versionFragment,
} from "@/test/msw/form-fixtures";
import { formRuntimeWorld } from "@/test/msw/form-runtime-handlers";
import { moduleAdminTree } from "@/test/msw/module-admin-fixtures";
import {
  type TestModuleAdminNode,
  moduleAdminWorld,
} from "@/test/msw/module-manager-handlers";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/render";

import { MODULE_MANAGER_PERMISSIONS } from "./module-manager-permissions";
import {
  FULL_PERMISSIONS,
  clickNode,
  detail,
  modulesWith,
  waitForTree,
} from "./module-manager-test-support";

const shoppingNode: TestModuleAdminNode = {
  id: "m-shop",
  key: "shopping-list",
  name: "購物清單",
  parentId: null,
  sidebarType: ModuleSidebarType.Link,
  route: "shopping-list",
  order: 3,
  description: null,
  icon: null,
  enabled: true,
  engine: ModuleEngine.Form,
  permissions: [],
  children: [],
};

const usage = (drafts: number, completed: number) => ({
  draftCount: drafts,
  draftVersions: drafts > 0 ? [2] : [],
  completedCount: completed,
  completedVersions: completed > 0 ? [1] : [],
});

const retiredPermission = (
  fieldKey: string,
  name: string,
  drafts: number,
  completed: number,
) => ({
  key: `shopping-list.show-shopping_list-${fieldKey}`,
  name,
  moduleKey: "shopping-list",
  formKey: SHOPPING_FORM_KEY,
  formName: "購物單",
  fieldKey,
  action: "show",
  retiredAt: "2026-09-21T00:00:00.000Z",
  usage: usage(drafts, completed),
});

const render = (permissions: readonly string[]) => {
  const design = formDesignWorld({
    forms: [formFragment()],
    versions: {
      [SHOPPING_FORM_KEY]: [
        versionFragment(shoppingDefinition(), {
          version: 1,
          status: FormVersionStatus.Published,
        }),
      ],
    },
    retired: [
      retiredPermission("old_price", "購物單 / 舊單價 可見", 1, 3),
      retiredPermission("old_note", "購物單 / 舊備註 可見", 0, 2),
    ],
    retiredOutcomes: {
      "shopping-list.show-shopping_list-old_price": {
        code: "PERMISSION_NOT_DELETABLE",
        extensions: { reasons: ["USED_BY_DRAFTS"], usage: usage(1, 3) },
      },
      "shopping-list.show-shopping_list-old_note": {
        code: "PERMISSION_NOT_DELETABLE",
        extensions: { reasons: ["CONFIRM_REQUIRED"], usage: usage(0, 2) },
      },
    },
  });
  server.use(
    ...moduleAdminWorld({ tree: [...moduleAdminTree, shoppingNode] }).handlers,
    ...design.handlers,
    ...formRuntimeWorld({
      versions: { [`${SHOPPING_FORM_KEY}@1`]: shoppingDefinition() },
    }).handlers,
    ...authWorld({ hasRefreshCookie: true, modules: modulesWith(permissions) })
      .handlers,
  );
  return { ...renderApp({ path: "/system/module-manager" }), design };
};

describe("模組與權限:表單模組的列表欄位配置、退役權限清理", () => {
  it("退役權限清理:草稿還在用 → 擋下並列出筆數;只剩已完成 → 警告確認後才刪", async () => {
    const { user, design } = render([
      ...FULL_PERMISSIONS,
      MODULE_MANAGER_PERMISSIONS.deleteRetiredPermission,
    ]);
    await waitForTree();

    await user.click(screen.getByRole("button", { name: "退役權限清理" }));
    const dialog = await screen.findByRole("dialog", { name: "退役權限清理" });
    await within(dialog).findByText("購物單 / 舊單價 可見");

    await user.click(
      within(dialog).getByRole("button", {
        name: "刪除權限「購物單 / 舊單價 可見」",
      }),
    );
    expect(
      await within(dialog).findByText(
        /還有 1 筆草稿\(v2\)用到「購物單 \/ 舊單價 可見」,不能刪除/,
      ),
    ).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("button", {
        name: "刪除權限「購物單 / 舊備註 可見」",
      }),
    );
    expect(
      await within(dialog).findByText(/只有超級管理員看得到/),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "確認刪除" }));

    await waitFor(() => {
      expect(design.inputs.deleteRetiredPermission).toHaveLength(3);
    });
    expect(design.inputs.deleteRetiredPermission[2]).toEqual({
      permissionKey: "shopping-list.show-shopping_list-old_note",
      confirmCompletedUsage: true,
    });
    await waitFor(() => {
      expect(within(dialog).queryByText("購物單 / 舊備註 可見")).toBeNull();
    });
  });

  it("沒有 delete-retired-permission:看得到清單、沒有刪除鈕", async () => {
    const { user } = render(FULL_PERMISSIONS);
    await waitForTree();

    await user.click(screen.getByRole("button", { name: "退役權限清理" }));
    const dialog = await screen.findByRole("dialog", { name: "退役權限清理" });
    await within(dialog).findByText("購物單 / 舊單價 可見");
    expect(
      within(dialog).queryByRole("button", { name: /刪除權限/ }),
    ).toBeNull();
  });

  it("列表欄位配置:表單模組才有這一列;加一欄表單欄位存檔整份覆蓋", async () => {
    const { user, design } = render([...FULL_PERMISSIONS, "system.forms.edit"]);
    await waitForTree();

    await clickNode(user, "購物清單");
    await user.click(
      await within(detail()).findByRole("button", { name: "設定列表欄位" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "列表欄位配置 — 購物清單",
    });
    await within(dialog).findByText(
      "目前沒有設定,列表使用預設欄(標題、日期)。",
    );

    await user.click(within(dialog).getByRole("button", { name: "+ 摘要槽" }));
    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", { name: "+ 表單欄位" }),
      ).toBeEnabled();
    });
    await user.click(
      within(dialog).getByRole("button", { name: "+ 表單欄位" }),
    );
    await user.click(within(dialog).getByRole("button", { name: "儲存" }));

    await waitFor(() => {
      expect(design.inputs.setModuleListColumns).toHaveLength(1);
    });
    expect(design.inputs.setModuleListColumns[0]).toEqual({
      moduleKey: "shopping-list",
      columns: [
        { kind: ModuleListColumnKind.Slot, key: "title", width: 180, order: 0 },
        {
          kind: ModuleListColumnKind.Field,
          key: "item",
          formKey: SHOPPING_FORM_KEY,
          width: 180,
          order: 1,
        },
      ],
    });
  });
});
