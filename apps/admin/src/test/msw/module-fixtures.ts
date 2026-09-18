import { ModuleSidebarType } from "@repo/graphql";

import { type TestModule, overviewModule } from "./auth-handlers";

/**
 * 與 `apps/db-migrator/seeds/modules/*` 同形的模組陣列(ADR-0011 步驟 7 的輸出形狀:
 * route 為完整路徑、api 樹 route 為 null),供殼的測試當 `me.modules` 夾具。
 * 順序刻意不照 order 排,驗證前端自行排序。
 */
const link = (
  id: string,
  key: string,
  name: string,
  parentId: string | null,
  order: number,
  route: string,
): TestModule => ({
  id,
  key,
  name,
  parentId,
  sidebarType: ModuleSidebarType.Link,
  order,
  route,
  permissions: [`${key}.*`],
});

const group = (
  id: string,
  key: string,
  name: string,
  parentId: string | null,
  order: number,
  route: string,
): TestModule => ({
  ...link(id, key, name, parentId, order, route),
  sidebarType: ModuleSidebarType.Group,
});

const hidden = (
  id: string,
  key: string,
  name: string,
  parentId: string | null,
  order: number,
  route: string | null,
): TestModule => ({
  ...link(id, key, name, parentId, order, route ?? ""),
  sidebarType: ModuleSidebarType.Hidden,
  route,
});

/** 系統管理群組 + 六個治理模組(seeds/modules/system.ts)。 */
export const systemModules: TestModule[] = [
  link(
    "m-user",
    "system.user-manager",
    "使用者管理",
    "m-system",
    2,
    "/system/user-manager",
  ),
  group("m-system", "system", "系統管理", null, 1, "/system"),
  link(
    "m-data-scope",
    "system.data-scope",
    "資料範圍",
    "m-system",
    6,
    "/system/data-scope",
  ),
  link(
    "m-org",
    "system.org-manager",
    "組織管理",
    "m-system",
    1,
    "/system/org-manager",
  ),
  link(
    "m-field",
    "system.field-manager",
    "欄位管理",
    "m-system",
    5,
    "/system/field-manager",
  ),
  link(
    "m-role",
    "system.role-manager",
    "角色管理",
    "m-system",
    3,
    "/system/role-manager",
  ),
  link(
    "m-module",
    "system.module-manager",
    "模組與權限",
    "m-system",
    4,
    "/system/module-manager",
  ),
];

/** 示範模組2 家族:示範群組 → 示範模組2 + 三個隱藏頁(seeds/modules/demo.sample-two.ts)。 */
export const sampleTwoModules: TestModule[] = [
  hidden(
    "m-two-edit",
    "demo.sample-two.edit-page",
    "編輯",
    "m-two",
    3,
    "/demo/sample-two/edit-page",
  ),
  group("m-demo", "demo", "示範群組", null, 2, "/demo"),
  link(
    "m-two",
    "demo.sample-two",
    "示範模組2",
    "m-demo",
    2,
    "/demo/sample-two",
  ),
  hidden(
    "m-two-view",
    "demo.sample-two.view-page",
    "詳情",
    "m-two",
    1,
    "/demo/sample-two/view-page",
  ),
  hidden(
    "m-two-create",
    "demo.sample-two.create-page",
    "新增",
    "m-two",
    2,
    "/demo/sample-two/create-page",
  ),
];

/** 示範模組1 家族:示範次群組 → 示範模組1 + 三個隱藏頁(seeds/modules/demo.sub.sample-one.ts)。 */
export const sampleOneModules: TestModule[] = [
  group("m-demo-sub", "demo.sub", "示範次群組", "m-demo", 1, "/demo/sub"),
  hidden(
    "m-one-edit",
    "demo.sub.sample-one.edit-page",
    "編輯示範項目",
    "m-one",
    3,
    "/demo/sub/sample-one/edit-page",
  ),
  link(
    "m-one",
    "demo.sub.sample-one",
    "示範模組1",
    "m-demo-sub",
    1,
    "/demo/sub/sample-one",
  ),
  hidden(
    "m-one-view",
    "demo.sub.sample-one.view-page",
    "示範項目詳情",
    "m-one",
    1,
    "/demo/sub/sample-one/view-page",
  ),
  hidden(
    "m-one-create",
    "demo.sub.sample-one.create-page",
    "新增示範項目",
    "m-one",
    2,
    "/demo/sub/sample-one/create-page",
  ),
];

/** 隱藏的純 API 樹:在陣列裡但 route 為 null(seeds/modules/api.ts)。 */
export const apiModules: TestModule[] = [
  hidden("m-api", "api", "API 能力", null, 99, null),
];

/** 超級管理員看到的全部:總覽 + 系統管理六項 + 示範家族 + api 樹。 */
export const superAdminModules: TestModule[] = [
  ...apiModules,
  overviewModule,
  ...sampleOneModules,
  ...systemModules,
  ...sampleTwoModules,
];
