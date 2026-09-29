import type { SeedDocumentSet } from "../src/seed/seed-declaration";

export const ROOT_ORG_KEY = "root";

/**
 * 根組織(平台營運者,CONTEXT.md「租戶」);唯一以 key 種子的組織(ADR-0005)。
 * 顯示名稱正本:docs/branding.md「orgs(根組織)name」。
 *
 * `settings` 是初始 seed 值的欄位(ADR-0002):根組織的 `settings.timezone` 是根組織資料的租戶時區,
 * 由人設定;每次部署都寫回 `{}` 會把它洗掉。
 */
export const orgs: SeedDocumentSet = {
  kind: "documents",
  collection: "orgs",
  initialSeedValueFields: ["enabled", "settings"],
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
