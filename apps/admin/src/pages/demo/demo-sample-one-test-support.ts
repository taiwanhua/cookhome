import { screen } from "@testing-library/react";

import { ModuleSidebarType } from "@repo/graphql";

import { type TestModule, authWorld } from "@/test/msw/auth-handlers";
import { demoHistory, demoItems } from "@/test/msw/demo-fixtures";
import {
  type DemoWorldOptions,
  demoWorld,
} from "@/test/msw/demo-sample-one-handlers";
import { fieldCategories, fieldsByCategory } from "@/test/msw/field-fixtures";
import { fieldWorld } from "@/test/msw/field-manager-handlers";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/render";

import {
  FIELD_MANAGER_VIEW_PERMISSION,
  SAMPLE_ONE_MODULE_KEYS,
  SAMPLE_ONE_PERMISSIONS,
} from "./demo-sample-one-config";

/**
 * 示範模組1 三頁測試的共用場景(列表 / 詳情 / 共版型三個測試檔共用):
 * 一份形狀,測試檔只寫行為(TEST-08)。
 *
 * 這一頁的權限有兩層,場景要兩個旋鈕分開轉:
 * - **綁了哪些模組**(`modules`)決定進得去哪一頁 —— 隱藏頁沒綁 = 殼的無權限頁
 * - **持有哪些權限**(`permissions`)決定頁內看得到什麼(內部備註、提示、歷程)
 */

export const SAMPLE_ONE_ROUTES = {
  list: "/demo/sub/sample-one",
  viewPage: "/demo/sub/sample-one/view-page",
  createPage: "/demo/sub/sample-one/create-page",
  editPage: "/demo/sub/sample-one/edit-page",
} as const;

/** 整個示範模組1 的權限 + 欄位管理檢視(分類下拉的選項來源)。 */
export const FULL_PERMISSIONS = [
  ...Object.values(SAMPLE_ONE_PERMISSIONS),
  FIELD_MANAGER_VIEW_PERMISSION,
];

/** 只看得到列表與單筆:沒有內部備註、沒有提示與歷程。 */
export const VIEW_ONLY = [
  SAMPLE_ONE_PERMISSIONS.view,
  FIELD_MANAGER_VIEW_PERMISSION,
];

/** 哪一頁的模組要放進 `me.modules`(沒放 = 沒綁 = 進不去)。 */
export type SampleOnePageKey = keyof typeof SAMPLE_ONE_ROUTES;

export const ALL_PAGES: SampleOnePageKey[] = [
  "list",
  "viewPage",
  "createPage",
  "editPage",
];

const module_ = (
  id: string,
  key: string,
  name: string,
  parentId: string | null,
  sidebarType: ModuleSidebarType,
  order: number,
  route: string,
  permissions: readonly string[],
): TestModule => ({
  id,
  key,
  name,
  parentId,
  sidebarType,
  order,
  route,
  icon: null,
  permissions: [...permissions],
});

/**
 * `me.modules`:示範群組 → 示範次群組 → 示範模組1 + 指定的隱藏頁。
 * 欄位管理也放進去(分類下拉要 `system.field-manager.view`,而權限掛在那個模組上)。
 */
export const modulesWith = (
  permissions: readonly string[],
  pages: readonly SampleOnePageKey[] = ALL_PAGES,
): TestModule[] => {
  const has = (page: SampleOnePageKey) => pages.includes(page);
  const own = (prefix: string) =>
    permissions.filter((key) => key.startsWith(prefix));

  const tree: TestModule[] = [
    module_(
      "m-demo",
      "demo",
      "示範群組",
      null,
      ModuleSidebarType.Group,
      2,
      "/demo",
      [],
    ),
    module_(
      "m-demo-sub",
      "demo.sub",
      "示範次群組",
      "m-demo",
      ModuleSidebarType.Group,
      1,
      "/demo/sub",
      [],
    ),
    module_(
      "m-field",
      "system.field-manager",
      "欄位管理",
      null,
      ModuleSidebarType.Link,
      9,
      "/system/field-manager",
      permissions.filter((key) => key === FIELD_MANAGER_VIEW_PERMISSION),
    ),
  ];

  if (has("list")) {
    tree.push(
      module_(
        "m-one",
        SAMPLE_ONE_MODULE_KEYS.list,
        "示範模組1",
        "m-demo-sub",
        ModuleSidebarType.Link,
        1,
        SAMPLE_ONE_ROUTES.list,
        own(`${SAMPLE_ONE_MODULE_KEYS.list}.`).filter(
          (key) => key.split(".").length === 4,
        ),
      ),
    );
  }
  if (has("viewPage")) {
    tree.push(
      module_(
        "m-one-view",
        SAMPLE_ONE_MODULE_KEYS.viewPage,
        "示範項目詳情",
        "m-one",
        ModuleSidebarType.Hidden,
        1,
        SAMPLE_ONE_ROUTES.viewPage,
        [],
      ),
    );
  }
  if (has("createPage")) {
    tree.push(
      module_(
        "m-one-create",
        SAMPLE_ONE_MODULE_KEYS.createPage,
        "新增示範項目",
        "m-one",
        ModuleSidebarType.Hidden,
        2,
        SAMPLE_ONE_ROUTES.createPage,
        own(`${SAMPLE_ONE_MODULE_KEYS.createPage}.`),
      ),
    );
  }
  if (has("editPage")) {
    tree.push(
      module_(
        "m-one-edit",
        SAMPLE_ONE_MODULE_KEYS.editPage,
        "編輯示範項目",
        "m-one",
        ModuleSidebarType.Hidden,
        3,
        SAMPLE_ONE_ROUTES.editPage,
        own(`${SAMPLE_ONE_MODULE_KEYS.editPage}.`),
      ),
    );
  }
  return tree;
};

export interface RenderSampleOneOptions {
  path?: string;
  permissions?: readonly string[];
  pages?: readonly SampleOnePageKey[];
  world?: DemoWorldOptions;
}

export const renderSampleOne = ({
  path = SAMPLE_ONE_ROUTES.list,
  permissions = FULL_PERMISSIONS,
  pages = ALL_PAGES,
  world = {},
}: RenderSampleOneOptions = {}) => {
  const fake = demoWorld({
    items: demoItems,
    history: demoHistory,
    canShowInternalNote: permissions.includes(
      SAMPLE_ONE_PERMISSIONS.showInternalNote,
    ),
    ...world,
  });
  server.use(
    ...fake.handlers,
    // 分類下拉的選項來源(欄位管理的「示範分類」);`CreateUploadUrl` 留給示範模組自己那一份
    ...fieldWorld({ categories: fieldCategories, fieldsByCategory }).handlers,
    ...authWorld({
      hasRefreshCookie: true,
      modules: modulesWith(permissions, pages),
    }).handlers,
  );
  return { ...renderApp({ path }), fake };
};

/** 清單的一列(以名稱找);清單是後到的,所以等它出現。 */
export const findRowOf = (name: string) =>
  screen.findByRole("row", { name: new RegExp(name) });
