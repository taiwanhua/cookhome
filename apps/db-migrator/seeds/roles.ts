import type {
  SeedDocumentSet,
  SeedRelationSet,
} from "../src/seed/seed-declaration";
import { ROOT_ORG_KEY } from "./orgs";

export const SUPER_ADMIN_ROLE_KEY = "super-admin";
export const TENANT_ADMIN_ROLE_KEY = "tenant-admin";

/**
 * 種子角色(術語正本:CONTEXT.md;開通流程:ADR-0009)。
 * - 超級管理員:isSystem,解析時直接全權放行(ADR-0004),僅可授予根組織的使用者
 * - 租戶管理員:模板,開通租戶時複製一份到該租戶名下
 *
 * 角色與模組/權限的綁定(role_module / role_permission)不在此(#29)。
 */
export const roles: SeedDocumentSet = {
  kind: "documents",
  collection: "roles",
  entries: [
    {
      key: SUPER_ADMIN_ROLE_KEY,
      data: {
        name: "超級管理員",
        description: "系統內建角色;僅可授予根組織的使用者",
        enabled: true,
        settings: {},
      },
    },
    {
      key: TENANT_ADMIN_ROLE_KEY,
      data: {
        name: "租戶管理員",
        description: "種子模板;開通租戶時複製一份到該租戶名下",
        enabled: true,
        settings: {},
      },
    },
  ],
};

/** 種子角色的擁有組織 = 根組織(每個角色只屬一個組織,ADR-0003;org_role 關聯,ADR-0001)。 */
export const roleOwners: SeedRelationSet = {
  kind: "relations",
  entries: [SUPER_ADMIN_ROLE_KEY, TENANT_ADMIN_ROLE_KEY].map((roleKey) => ({
    type: "org_role",
    first: { collection: "orgs", key: ROOT_ORG_KEY },
    second: { collection: "roles", key: roleKey },
  })),
};
