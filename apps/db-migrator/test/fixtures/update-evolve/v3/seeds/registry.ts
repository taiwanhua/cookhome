import { fieldCategories } from "../../../../../seeds/base/field-categories";
import { assembleSeedRegistry } from "../../../../../seeds/registry";
import type {
  SeedDocumentSet,
  SeedRegistry,
} from "../../../../../src/seed/seed-declaration";
import {
  fixtureProjectSettings,
  fixtureProjectSource,
} from "../../../seeds-project/project-source";
import { seed as ticketR3 } from "./project/revisions/update_ticket.r3.seed";

/** 專案在底座的欄位類別之外多登記一個(目前的名稱;第二版當時的名稱在快照裡)。 */
const projectFieldCategories: SeedDocumentSet = {
  ...fieldCategories,
  entries: [
    {
      key: "ticket-priority",
      data: { name: "優先度", description: null, enabled: true },
    },
  ],
};

/**
 * 夾具「版本 3」的 registry:工單只登記目前有效的第三版(第一、二版的快照留在 `revisions/`,
 * 只有 migration 明示依賴時才會被載入);舊版登記表已不再登記。
 */
export const seedRegistry: SeedRegistry = assembleSeedRegistry(
  fixtureProjectSettings,
  {
    ...fixtureProjectSource,
    seeds: [...fixtureProjectSource.seeds, projectFieldCategories, ticketR3],
  },
);
