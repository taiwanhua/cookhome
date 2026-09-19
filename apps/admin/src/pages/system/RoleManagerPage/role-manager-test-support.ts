import { screen } from "@testing-library/react";

import { ModuleSidebarType } from "@repo/graphql";

import {
  type TestModule,
  authWorld,
  overviewModule,
} from "@/test/msw/auth-handlers";
import {
  type RoleWorldOptions,
  roleWorld,
} from "@/test/msw/role-manager-handlers";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/render";

import {
  ORG_MANAGER_VIEW_PERMISSION,
  ROLE_MANAGER_PERMISSIONS,
  USER_MANAGER_VIEW_PERMISSION,
} from "./role-manager-permissions";

/**
 * 角色管理頁測試的共用 world 與 helper(TEST-08「共用的 world / 夾具 / helper 抽成
 * `<page>-test-support.ts`」)。
 */

/** 擁有組織下拉要 `system.org-manager.view`、加入使用者的候選要 `system.user-manager.view`。 */
export const ALL_PERMISSIONS = [
  ...Object.values(ROLE_MANAGER_PERMISSIONS),
  ORG_MANAGER_VIEW_PERMISSION,
  USER_MANAGER_VIEW_PERMISSION,
];

const ROLE_PREFIX = "system.role-manager.";

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
    permissions: permissions.includes(ORG_MANAGER_VIEW_PERMISSION)
      ? [ORG_MANAGER_VIEW_PERMISSION]
      : [],
  },
  {
    id: "m-user",
    key: "system.user-manager",
    name: "使用者管理",
    parentId: "m-system",
    sidebarType: ModuleSidebarType.Link,
    order: 2,
    route: "/system/user-manager",
    permissions: permissions.includes(USER_MANAGER_VIEW_PERMISSION)
      ? [USER_MANAGER_VIEW_PERMISSION]
      : [],
  },
  {
    id: "m-role",
    key: "system.role-manager",
    name: "角色管理",
    parentId: "m-system",
    sidebarType: ModuleSidebarType.Link,
    order: 3,
    route: "/system/role-manager",
    permissions: permissions.filter((key) => key.startsWith(ROLE_PREFIX)),
  },
];

export interface RenderRolePageOptions {
  permissions?: readonly string[];
  world?: RoleWorldOptions;
}

/** 當前組織 = 租戶頂層(擁有組織下拉的預設值就是它)。 */
const CURRENT_ORG = { id: "org-tenant", name: "租戶 A" };

export const renderRolePage = ({
  permissions = ALL_PERMISSIONS,
  world = {},
}: RenderRolePageOptions = {}) => {
  const fake = roleWorld(world);
  server.use(
    ...fake.handlers,
    ...authWorld({
      hasRefreshCookie: true,
      modules: modulesWith(permissions),
      orgs: [CURRENT_ORG],
    }).handlers,
  );
  return { ...renderApp({ path: "/system/role-manager" }), fake };
};

/** 矩陣的一列:以「標籤 + key」開頭找(同一棵樹裡有好幾個「全部(*)」)。 */
export const matrixRow = (labelWithKey: string): HTMLElement => {
  const row = screen
    .getAllByRole("treeitem")
    .find((item) => item.textContent.startsWith(labelWithKey));
  if (row === undefined) {
    throw new Error(`找不到矩陣上的「${labelWithKey}」這一列`);
  }
  return row;
};

/** 某一列自己的核取方塊(DOM 上是該列的第一個 input)。 */
export const matrixCheckbox = (labelWithKey: string): HTMLInputElement => {
  const checkbox = matrixRow(labelWithKey).querySelector<HTMLInputElement>(
    "input[type='checkbox']",
  );
  if (checkbox === null) {
    throw new Error(`「${labelWithKey}」這一列沒有核取方塊`);
  }
  return checkbox;
};
