import type { SeedRegistry } from "../src/seed/seed-declaration";
import { fieldCategories } from "./field-categories";
import { fields } from "./fields";
import { dataScopeTargets, modules, permissions } from "./modules";
import { orgs } from "./orgs";
import { tenantAdminBindings } from "./role-bindings";
import { roleOwners, roles } from "./roles";
import { rootAdmin } from "./root-admin";

/**
 * 收齊所有種子(正本:ADR-0002)。新增一類種子 = 新增一個宣告檔並在此註冊。
 * 順序即執行順序:被引用者在前(組織 → 角色 → 角色擁有組織 → root 初始帳號 → 欄位類別 → 欄位選項
 * → 模組樹 → 權限 → 資料範圍目標 → 種子角色綁定)。
 */
export const seedRegistry: SeedRegistry = [
  orgs,
  roles,
  roleOwners,
  rootAdmin,
  fieldCategories,
  fields,
  modules,
  permissions,
  dataScopeTargets,
  tenantAdminBindings,
];
