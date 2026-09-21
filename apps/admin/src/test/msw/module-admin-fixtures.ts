import { ModuleSidebarType } from "@repo/graphql";

import type {
  TestModuleAdminNode,
  TestPermissionAdmin,
} from "./module-manager-handlers";

/**
 * 模組與權限頁(#209)的夾具:`moduleTree` 的**治理面全樹**。
 *
 * 與 `module-fixtures.ts` 是兩種相反的讀法,所以刻意分兩份:那邊是 `me.modules`
 * (「我能用什麼」,已被 enabled 過濾掉),這邊含側欄看不到的 hidden 節點、
 * 隱藏的 api 權限樹,以及**已停用**的模組與權限(停用以 `enabled` 表示,不以「不回」表示)。
 * 形狀以 `docs/modules/module-manager.md`「回傳欄位語意」與 api 測試的斷言為準(TEST-08)。
 */

/** `<模組 key>.*`:seed 自動產生、恆排最前的那一筆。 */
const allPermission = (moduleKey: string): TestPermissionAdmin => ({
  id: `perm-${moduleKey}-all`,
  key: `${moduleKey}.*`,
  name: "全部",
  description: "這個模組的全部權限",
  enabled: true,
});

const permission = (
  moduleKey: string,
  action: string,
  name: string,
  overrides: Partial<TestPermissionAdmin> = {},
): TestPermissionAdmin => ({
  id: `perm-${moduleKey}-${action}`,
  key: `${moduleKey}.${action}`,
  name,
  description: null,
  enabled: true,
  ...overrides,
});

const node = (
  id: string,
  key: string,
  name: string,
  parentId: string | null,
  order: number,
  overrides: Partial<TestModuleAdminNode> = {},
): TestModuleAdminNode => ({
  id,
  key,
  name,
  parentId,
  sidebarType: ModuleSidebarType.Link,
  order,
  description: null,
  /** 側欄圖示(#288):預設不給,要對照初值表的節點各自用 `overrides` 指定 */
  icon: null,
  enabled: true,
  permissions: [allPermission(key)],
  children: [],
  ...overrides,
});

/** 系統管理群組底下的六個治理模組(seeds/modules/system.ts 的形狀)。 */
const systemChildren: TestModuleAdminNode[] = [
  node("m-org", "system.org-manager", "組織管理", "m-system", 1, {
    description: "維護組織樹與租戶",
    icon: "business",
    permissions: [
      allPermission("system.org-manager"),
      permission("system.org-manager", "view", "檢視組織"),
      permission("system.org-manager", "edit", "編輯組織"),
    ],
    children: [
      node(
        "m-tenant-ops",
        "system.org-manager.tenant-ops",
        "租戶作業",
        "m-org",
        1,
        {
          sidebarType: ModuleSidebarType.Hidden,
          icon: "key",
          permissions: [
            allPermission("system.org-manager.tenant-ops"),
            permission(
              "system.org-manager.tenant-ops",
              "provision",
              "開通租戶",
            ),
          ],
        },
      ),
    ],
  }),
  node("m-user", "system.user-manager", "使用者管理", "m-system", 2, {
    icon: "people",
  }),
  node("m-role", "system.role-manager", "角色管理", "m-system", 3, {
    icon: "shield",
  }),
  node("m-module", "system.module-manager", "模組與權限", "m-system", 4, {
    description: "檢視模組樹與各模組的權限清單",
    icon: "apps",
    permissions: [
      allPermission("system.module-manager"),
      permission("system.module-manager", "view", "檢視模組樹"),
      permission(
        "system.module-manager",
        "toggle-enabled",
        "切換模組 / 權限啟用",
      ),
      permission("system.module-manager", "set-icon", "設定模組側欄圖示"),
    ],
  }),
  node("m-field", "system.field-manager", "欄位管理", "m-system", 5, {
    icon: "label",
  }),
  node("m-data-scope", "system.data-scope", "資料範圍", "m-system", 6, {
    icon: "filter",
  }),
];

/**
 * 示範群組:`demo.sample-two` 已停用 —— 停用連動整棵子樹,所以它底下的隱藏頁
 * 也一併是 `enabled: false`(樹上讀到什麼就是什麼,不必回頭看祖先)。
 */
const demoChildren: TestModuleAdminNode[] = [
  node("m-two", "demo.sample-two", "示範模組2", "m-demo", 2, {
    enabled: false,
    icon: "list",
    permissions: [
      allPermission("demo.sample-two"),
      permission("demo.sample-two", "view", "檢視示範項目", {
        enabled: false,
      }),
    ],
    children: [
      node("m-two-edit", "demo.sample-two.edit-page", "編輯", "m-two", 3, {
        sidebarType: ModuleSidebarType.Hidden,
        enabled: false,
      }),
    ],
  }),
];

/** 全樹(樹根陣列):總覽、系統管理、示範群組,以及沒有路由的隱藏 api 樹。 */
export const moduleAdminTree: TestModuleAdminNode[] = [
  node("m-overview", "overview", "總覽", null, 0, { icon: "dashboard" }),
  node("m-system", "system", "系統管理", null, 1, {
    sidebarType: ModuleSidebarType.Group,
    icon: "settings",
    permissions: [],
    children: systemChildren,
  }),
  node("m-demo", "demo", "示範群組", null, 2, {
    sidebarType: ModuleSidebarType.Group,
    icon: "extension",
    permissions: [],
    children: demoChildren,
  }),
  node("m-api", "api", "API 能力", null, 99, {
    sidebarType: ModuleSidebarType.Hidden,
    icon: "tune",
    permissions: [
      allPermission("api"),
      permission("api", "export", "匯出資料", { enabled: false }),
    ],
  }),
];
