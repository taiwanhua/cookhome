import type { SeedDocumentSet } from "../src/seed/seed-declaration";

/**
 * 根組織(平台營運者,CONTEXT.md「租戶」);唯一以 key 種子的組織(ADR-0005)。
 * 顯示名稱正本:docs/branding.md「orgs(根組織)name」。
 */
export const orgs: SeedDocumentSet = {
  kind: "documents",
  collection: "orgs",
  entries: [
    {
      key: "root",
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
