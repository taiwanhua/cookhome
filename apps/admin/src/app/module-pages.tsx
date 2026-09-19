import { OverviewPage } from "../pages/OverviewPage/OverviewPage";
import { DataScopePage } from "../pages/system/DataScopePage/DataScopePage";
import { DATA_SCOPE_MODULE_KEY } from "../pages/system/DataScopePage/data-scope-permissions";
import { ModuleManagerPage } from "../pages/system/ModuleManagerPage/ModuleManagerPage";
import { MODULE_MANAGER_MODULE_KEY } from "../pages/system/ModuleManagerPage/module-manager-permissions";
import { OrgManagerPage } from "../pages/system/OrgManagerPage/OrgManagerPage";
import { ORG_MANAGER_MODULE_KEY } from "../pages/system/OrgManagerPage/org-manager-permissions";
import { RoleManagerPage } from "../pages/system/RoleManagerPage/RoleManagerPage";
import { ROLE_MANAGER_MODULE_KEY } from "../pages/system/RoleManagerPage/role-manager-permissions";
import { UserManagerPage } from "../pages/system/UserManagerPage/UserManagerPage";
import { USER_MANAGER_MODULE_KEY } from "../pages/system/UserManagerPage/user-manager-permissions";
import type { ModulePageRegistry } from "./guards/ModuleRoute/ModuleRoute";

/** 總覽模組 key(seed 正本:apps/db-migrator/seeds/modules/overview.ts;admin 不能 import db-migrator,STRUCT-01)。 */
export const OVERVIEW_MODULE_KEY = "overview";

/**
 * 模組 key → 頁面元件(組裝層,STRUCT-03):各模組實作時在此登記;
 * 沒登記的模組由殼顯示佔位頁(模組名)。路由本身仍由 `me.modules` 決定,這裡只決定「進去看到什麼」。
 */
export const modulePages: ModulePageRegistry = {
  [OVERVIEW_MODULE_KEY]: OverviewPage,
  [ORG_MANAGER_MODULE_KEY]: OrgManagerPage,
  [MODULE_MANAGER_MODULE_KEY]: ModuleManagerPage,
  [USER_MANAGER_MODULE_KEY]: UserManagerPage,
  [ROLE_MANAGER_MODULE_KEY]: RoleManagerPage,
  [DATA_SCOPE_MODULE_KEY]: DataScopePage,
};
