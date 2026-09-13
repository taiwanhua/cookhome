import type { SeedDocumentSet } from "../src/seed/seed-declaration";

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
      key: "super-admin",
      data: {
        name: "超級管理員",
        description: "系統內建角色;僅可授予根組織的使用者",
        enabled: true,
        settings: {},
      },
    },
    {
      key: "tenant-admin",
      data: {
        name: "租戶管理員",
        description: "種子模板;開通租戶時複製一份到該租戶名下",
        enabled: true,
        settings: {},
      },
    },
  ],
};
