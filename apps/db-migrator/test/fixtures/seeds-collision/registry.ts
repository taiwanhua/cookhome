import { projectSeedSource } from "../../../seeds/project/registry";
import { projectSeedSettings } from "../../../seeds/project/settings";
import { assembleSeedRegistry } from "../../../seeds/registry";
import type { SeedRegistry } from "../../../src/seed/seed-declaration";

/**
 * 夾具 registry(撞 key):專案來源重宣告底座的根組織 —— 組裝入口應在載入時就拒絕,
 * seed 指令以非零結束,資料庫一筆都不寫。
 */
export const seedRegistry: SeedRegistry = assembleSeedRegistry(
  projectSeedSettings,
  {
    ...projectSeedSource,
    seeds: [
      {
        kind: "documents",
        collection: "orgs",
        initialSeedValueFields: ["name", "description", "enabled", "settings"],
        entries: [
          {
            key: "root",
            data: { name: "專案想覆蓋的名稱", enabled: true, settings: {} },
          },
        ],
      },
    ],
  },
);
