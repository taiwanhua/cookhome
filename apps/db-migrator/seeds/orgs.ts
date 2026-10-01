import type { SeedDocumentSet } from "../src/seed/seed-declaration";

export const ROOT_ORG_KEY = "root";

/**
 * 根組織(平台營運者,CONTEXT.md「租戶」);唯一以 key 種子的組織(ADR-0005)。
 * 顯示名稱正本:docs/branding.md「orgs(根組織)name」。
 *
 * 名稱、描述、開關與 settings 都是初始 seed 值(ADR-0002):建立時給專案宣告值,
 * 之後保留人在後台的修改(含清空描述與 settings.timezone);完整清庫還原才重建為宣告值。
 */
export const orgs: SeedDocumentSet = {
  kind: "documents",
  collection: "orgs",
  initialSeedValueFields: ["name", "description", "enabled", "settings"],
  entries: [
    {
      key: ROOT_ORG_KEY,
      data: {
        name: "CookHome",
        parentId: null,
        ancestors: [],
        enabled: true,
        description: "平台營運者(根組織)",
        settings: {},
      },
    },
  ],
};
