import { assembleSeedRegistry } from "../../../../../seeds/registry";
import type { SeedRegistry } from "../../../../../src/seed/seed-declaration";
import {
  fixtureProjectSettings,
  fixtureProjectSource,
} from "../../../seeds-project/project-source";
import { seed as archivedR1 } from "../../revisions/reset_archived.r1.seed";
import { seed as leavingR1 } from "../../revisions/reset_leaving.r1.seed";
import { seed as orderR1 } from "../../revisions/reset_order.r1.seed";
import { seed as reviewR1 } from "../../revisions/reset_review.r1.seed";

/**
 * 夾具「第一版」的 registry:訂購單初版(兩個欄位有欄位級權限)、它的審核流程、一張之後會退出登記的表單、
 * 一張明示退役的表單。「第二版」(`../../v2/`)把訂購單改到第二版,並不再登記 `reset_leaving`。
 */
export const seedRegistry: SeedRegistry = assembleSeedRegistry(
  fixtureProjectSettings,
  {
    ...fixtureProjectSource,
    seeds: [
      ...fixtureProjectSource.seeds,
      orderR1,
      reviewR1,
      leavingR1,
      archivedR1,
    ],
  },
);
