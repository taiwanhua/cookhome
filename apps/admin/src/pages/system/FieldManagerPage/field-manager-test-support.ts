import { screen, within } from "@testing-library/react";

import { ModuleSidebarType } from "@repo/graphql";

import {
  type TestModule,
  type TestOrg,
  authWorld,
  overviewModule,
} from "@/test/msw/auth-handlers";
import {
  fieldCategories,
  fieldsByCategory,
} from "@/test/msw/field-fixtures";
import {
  type FieldWorldOptions,
  fieldWorld,
} from "@/test/msw/field-manager-handlers";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/render";

import { FIELD_MANAGER_PERMISSIONS } from "./field-manager-permissions";

/**
 * 欄位管理頁測試的共用場景(`FieldManagerPage.test.tsx` 與 `FieldManagerSeed.test.tsx`
 * 共用):一份形狀,測試檔只寫行為(TEST-08)。
 */

export const VIEW_ONLY = [FIELD_MANAGER_PERMISSIONS.view];
export const FULL_PERMISSIONS = Object.values(FIELD_MANAGER_PERMISSIONS);

/** 當前組織 = 來源欄「<組織名稱> 自訂」的名稱來源(`me.currentOrg`)。 */
export const currentOrg: TestOrg = { id: "org-tenant", name: "租戶 A" };

const systemGroup: TestModule = {
  id: "m-system",
  key: "system",
  name: "系統管理",
  parentId: null,
  sidebarType: ModuleSidebarType.Group,
  order: 1,
  route: "/system",
  permissions: [],
};

/** 根組織專屬模組:`me.modules` 裡有它 = 站在根組織(見 `field-manager-permissions.ts`)。 */
const moduleManagerModule: TestModule = {
  id: "m-module",
  key: "system.module-manager",
  name: "模組與權限",
  parentId: "m-system",
  sidebarType: ModuleSidebarType.Link,
  order: 4,
  route: "/system/module-manager",
  permissions: ["system.module-manager.view"],
};

export const modulesWith = (
  permissions: readonly string[],
  { isRoot = false }: { isRoot?: boolean } = {},
): TestModule[] => [
  overviewModule,
  systemGroup,
  ...(isRoot ? [moduleManagerModule] : []),
  {
    id: "m-field",
    key: "system.field-manager",
    name: "欄位管理",
    parentId: "m-system",
    sidebarType: ModuleSidebarType.Link,
    order: 5,
    route: "/system/field-manager",
    permissions: [...permissions],
  },
];

export const renderPage = ({
  permissions = FULL_PERMISSIONS,
  isRoot = false,
  world = {},
}: {
  permissions?: readonly string[];
  /** 操作者站在根組織:`me.modules` 多一個根組織專屬模組,假 api 也放行種子開關 */
  isRoot?: boolean;
  world?: FieldWorldOptions;
} = {}) => {
  const fake = fieldWorld({
    categories: fieldCategories,
    fieldsByCategory,
    isRootOperator: isRoot,
    ...world,
  });
  server.use(
    ...fake.handlers,
    ...authWorld({
      hasRefreshCookie: true,
      orgs: [currentOrg],
      modules: modulesWith(permissions, { isRoot }),
    }).handlers,
  );
  return { ...renderApp({ path: "/system/field-manager" }), fake };
};

/** 類別清單與選項表格各自收斂:兩邊都可能出現同一個名稱。 */
export const categoryList = () =>
  screen.getByRole("region", { name: "欄位類別" });
export const optionsPanel = () =>
  screen.getByRole("region", { name: "欄位選項" });

/**
 * 選一個類別並等右邊換好。頁面是「恢復登入 → me → 類別 → 選項」四段接力,
 * 所以每一步都要等(同步的 `getBy*` 會在還在轉圈時就炸,TEST-08)。
 */
export const selectCategory = async (
  actor: { click: (element: Element) => Promise<void> },
  name: string,
) => {
  const list = await screen.findByRole("region", { name: "欄位類別" });
  await actor.click(await within(list).findByText(name));
  await screen.findByText(`${name} — 選項`);
};

/** 表格的一列(以顯示名稱找);清單是後到的,所以等它出現。 */
export const findRowOf = (label: string) =>
  screen.findByRole("row", { name: new RegExp(label) });
