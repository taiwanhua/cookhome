import type { SeedDocumentSet } from "../../src/seed/seed-declaration";
import type { RootOrgSettings } from "./seed-source";

export const ROOT_ORG_KEY = "root";

/**
 * 根組織(平台營運者,CONTEXT.md「租戶」);唯一以 key 種子的組織(ADR-0005)。
 * 結構、key 與初始值欄位政策由底座定義;顯示名稱、說明與 settings 的初值來自專案
 * (`seeds/project/settings.ts` 的 `rootOrg`;名稱正本:docs/branding.md「orgs(根組織)name」)。
 * 專案不得另外宣告 `orgs/root` 來覆蓋這一筆(組裝時撞 key 直接拒絕)。
 *
 * 名稱、描述、開關與 settings 都是初始 seed 值(ADR-0002):建立時給專案宣告值,
 * 之後保留人在後台的修改(含清空描述與 settings.timezone);完整清庫還原才重建為宣告值。
 */
export function rootOrgSeed(rootOrg: RootOrgSettings): SeedDocumentSet {
  return {
    kind: "documents",
    collection: "orgs",
    initialSeedValueFields: ["name", "description", "enabled", "settings"],
    entries: [
      {
        key: ROOT_ORG_KEY,
        data: {
          name: rootOrg.name,
          parentId: null,
          ancestors: [],
          enabled: true,
          description: rootOrg.description,
          settings: rootOrg.settings,
        },
      },
    ],
  };
}
