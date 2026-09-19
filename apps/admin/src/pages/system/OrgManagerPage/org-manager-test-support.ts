import { expect } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { ModuleSidebarType } from "@repo/graphql";

import {
  type TestModule,
  authWorld,
  overviewModule,
} from "@/test/msw/auth-handlers";
import {
  orgDetails,
  orgUsers,
  rootTree,
  tenantModuleOptions,
} from "@/test/msw/org-fixtures";
import {
  type OrgWorldOptions,
  orgWorld,
} from "@/test/msw/org-manager-handlers";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/render";

import { ORG_MANAGER_PERMISSIONS } from "./org-manager-permissions";

/** 組織管理層的自有權限(租戶管理員靠 `system.org-manager.*` 拿到的那一組,扣掉可見範圍開關)。 */
export const OWN_PERMISSIONS = [
  ORG_MANAGER_PERMISSIONS.view,
  ORG_MANAGER_PERMISSIONS.createChild,
  ORG_MANAGER_PERMISSIONS.edit,
  ORG_MANAGER_PERMISSIONS.toggleEnabled,
  ORG_MANAGER_PERMISSIONS.move,
  ORG_MANAGER_PERMISSIONS.delete,
];

/** 根組織專屬(隱藏的 `tenant-ops` 模組);租戶管理員模板永遠拿不到。 */
export const TENANT_OPS_PERMISSIONS = [
  ORG_MANAGER_PERMISSIONS.provision,
  ORG_MANAGER_PERMISSIONS.transferOwner,
];

/** 2026-09-19 搬到組織管理層(#187):租戶管理員靠 `system.org-manager.*` 自動取得。 */
export const SET_VISIBILITY_PERMISSION = ORG_MANAGER_PERMISSIONS.setVisibility;

export const USER_VIEW_PERMISSION = "system.user-manager.view";

const modulesWith = (permissions: readonly string[]): TestModule[] => [
  overviewModule,
  {
    id: "m-system",
    key: "system",
    name: "系統管理",
    parentId: null,
    sidebarType: ModuleSidebarType.Group,
    order: 1,
    route: "/system",
    permissions: [],
  },
  {
    id: "m-org",
    key: "system.org-manager",
    name: "組織管理",
    parentId: "m-system",
    sidebarType: ModuleSidebarType.Link,
    order: 1,
    route: "/system/org-manager",
    permissions: permissions.filter((key) => !key.includes("tenant-ops")),
  },
  {
    id: "m-tenant-ops",
    key: "system.org-manager.tenant-ops",
    name: "租戶作業",
    parentId: "m-org",
    sidebarType: ModuleSidebarType.Hidden,
    order: 1,
    route: null,
    permissions: permissions.filter((key) => key.includes("tenant-ops")),
  },
  {
    id: "m-user",
    key: "system.user-manager",
    name: "使用者管理",
    parentId: "m-system",
    sidebarType: ModuleSidebarType.Link,
    order: 2,
    route: "/system/user-manager",
    permissions: permissions.includes(USER_VIEW_PERMISSION)
      ? [USER_VIEW_PERMISSION]
      : [],
  },
];

/** 兩支測試檔共用的渲染入口(預設是「什麼權限都有、管理範圍是全部」的根組織操作者)。 */
export const renderPage = ({
  permissions = [
    ...OWN_PERMISSIONS,
    ...TENANT_OPS_PERMISSIONS,
    SET_VISIBILITY_PERMISSION,
    USER_VIEW_PERMISSION,
  ],
  world = {},
}: {
  permissions?: readonly string[];
  world?: OrgWorldOptions;
} = {}) => {
  const fake = orgWorld({
    orgTree: rootTree,
    orgs: orgDetails,
    users: orgUsers,
    moduleOptions: tenantModuleOptions,
    ...world,
  });
  server.use(
    ...fake.handlers,
    ...authWorld({
      hasRefreshCookie: true,
      modules: modulesWith(permissions),
    }).handlers,
  );
  return { ...renderApp({ path: "/system/org-manager" }), fake };
};

/** 樹與資料區都有組織名稱(側欄的組織切換器也是),查詢一律先收斂到其中一邊。 */
export const orgTree = () => screen.getByRole("tree", { name: "組織樹" });
export const detail = () => screen.getByRole("region", { name: "組織資料" });

/** 節點自己的標籤(不含子孫:treeitem 的 textContent 會把整棵子樹串進來)。 */
const labelOf = (item: Element) =>
  item.querySelector(".MuiTreeItem-label")?.textContent ?? "";

export const treeItem = (name: string) =>
  within(orgTree())
    .getAllByRole("treeitem")
    .find((item) => labelOf(item).startsWith(name));

export const treeLabel = (name: string) => {
  const item = treeItem(name);
  return item === undefined ? undefined : labelOf(item);
};

/**
 * 樹是先渲染骨架、資料後到的;載入完成時 MUI 會換掉整個樹根元素,
 * 所以每次輪詢都要重新查(抓住舊的那顆會永遠等不到)。
 */
export const waitForTree = async (anyNodeName = "A-1 內容組") => {
  await waitFor(() => {
    expect(within(orgTree()).getByText(anyNodeName)).toBeInTheDocument();
  });
};

/**
 * 點一個節點。MUI 的樹**點內容區等於同時選取與展開 / 收合**(預設的 expansionTrigger),
 * 所以點過的節點會收起來 — 測試不要在點完某個節點之後再去找它的子節點。
 */
export const clickNode = async (
  actor: { click: (element: Element) => Promise<void> },
  name: string,
) => {
  await actor.click(await within(orgTree()).findByText(name));
};

/**
 * `jest-fixed-jsdom` 補回來的 `URL` 是 Node 的:`createObjectURL` 只收 Node 的 Blob,
 * 餵 jsdom 的 File 會丟型別錯,讓 `UploadField` 的預覽在 render 期整個炸掉。
 * 預覽不是這一頁要驗的行為,測試期間給一個固定網址即可。
 */
export const stubObjectUrls = (): (() => void) => {
  const real = {
    createObjectURL: URL.createObjectURL.bind(URL),
    revokeObjectURL: URL.revokeObjectURL.bind(URL),
  };
  URL.createObjectURL = () => "blob:logo-preview";
  URL.revokeObjectURL = () => {
    // 預覽網址是假的,不用釋放
  };
  return () => {
    URL.createObjectURL = real.createObjectURL;
    URL.revokeObjectURL = real.revokeObjectURL;
  };
};
