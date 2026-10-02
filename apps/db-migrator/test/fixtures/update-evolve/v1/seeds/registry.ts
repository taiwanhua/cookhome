import { assembleSeedRegistry } from "../../../../../seeds/registry";
import type { SeedRegistry } from "../../../../../src/seed/seed-declaration";
import {
  fixtureProjectSettings,
  fixtureProjectSource,
} from "../../../seeds-project/project-source";
import { seed as legacyR1 } from "./project/revisions/update_legacy.r1.seed";
import { seed as ticketR1 } from "./project/revisions/update_ticket.r1.seed";

/**
 * 夾具「版本 1」的 registry:專案登記兩張共用表單的初版(工單、舊版登記表)。
 * 之後的「版本 3」(`../../v3/`)把工單改到第三版,並不再登記舊版登記表。
 */
export const seedRegistry: SeedRegistry = assembleSeedRegistry(
  fixtureProjectSettings,
  {
    ...fixtureProjectSource,
    seeds: [...fixtureProjectSource.seeds, ticketR1, legacyR1],
  },
);
