import { assembleSeedRegistry } from "../../../seeds/registry";
import type { SeedRegistry } from "../../../src/seed/seed-declaration";
import {
  baseOnlyProjectSettings,
  baseOnlyProjectSource,
} from "../seeds-base/project-source";

/**
 * 夾具 registry(撞 key):專案來源重宣告底座的根組織 —— 組裝入口應在載入時就拒絕,
 * seed 指令以非零結束,資料庫一筆都不寫。疊在空的專案來源夾具上,被拒絕的原因只有這一筆。
 */
export const seedRegistry: SeedRegistry = assembleSeedRegistry(
  baseOnlyProjectSettings,
  {
    ...baseOnlyProjectSource,
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
