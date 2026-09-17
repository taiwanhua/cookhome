import type {
  SeedRelation,
  SeedRelationSet,
} from "../src/seed/seed-declaration";
import {
  MODULES_COLLECTION,
  PERMISSIONS_COLLECTION,
} from "../src/seed/seed-key-convention";
import { WILDCARD_ACTION } from "./module-declaration";
import {
  isRootOnlyModule,
  moduleNodes,
  permissionDeclarations,
} from "./modules";
import { TENANT_ADMIN_ROLE_KEY } from "./roles";

const tenantAdmin = { collection: "roles", key: TENANT_ADMIN_ROLE_KEY };

/**
 * 種子角色的模組/權限綁定(核心關聯,ADR-0001;命名順序 Role > Module > Permission)。
 *
 * - 租戶管理員模板 = 全部非根組織專屬模組(role_module)+ 各該模組的 wildcard(role_permission,
 *   ADR-0004:只存 `*` 一筆;ADR-0009:扣除根組織專屬模組)。由模組/權限宣告推導,
 *   新模組加入即自動納入模板(既有租戶的副本不會自動拿到,ADR-0009)。
 * - 超級管理員不造任何綁定:持有者解析時直接全權放行(ADR-0004)。
 */
const moduleBindings: SeedRelation[] = moduleNodes
  .filter((node) => !isRootOnlyModule(node.key))
  .map((node) => ({
    type: "role_module",
    first: tenantAdmin,
    second: { collection: MODULES_COLLECTION, key: node.key },
  }));

const wildcardBindings: SeedRelation[] = permissionDeclarations
  .filter(
    (permission) =>
      permission.key.endsWith(`.${WILDCARD_ACTION}`) &&
      !isRootOnlyModule(permission.moduleKey),
  )
  .map((permission) => ({
    type: "role_permission",
    first: tenantAdmin,
    second: { collection: PERMISSIONS_COLLECTION, key: permission.key },
  }));

export const tenantAdminBindings: SeedRelationSet = {
  kind: "relations",
  entries: [...moduleBindings, ...wildcardBindings],
};
