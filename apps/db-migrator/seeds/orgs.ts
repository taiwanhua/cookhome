import type { SeedDocumentSet } from "../src/seed/seed-declaration";

export const ROOT_ORG_KEY = "root";

/**
 * 根組織(平台營運者,CONTEXT.md「租戶」);唯一以 key 種子的組織(ADR-0005)。
 * 顯示名稱正本:docs/branding.md「orgs(根組織)name」。
 */
export const orgs: SeedDocumentSet = {
  kind: "documents",
  collection: "orgs",
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
