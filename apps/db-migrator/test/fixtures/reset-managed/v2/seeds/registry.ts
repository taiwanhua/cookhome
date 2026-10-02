import { assembleSeedRegistry } from "../../../../../seeds/registry";
import type { SeedRegistry } from "../../../../../src/seed/seed-declaration";
import {
  fixtureProjectSettings,
  fixtureProjectSource,
} from "../../../seeds-project/project-source";
import { seed as archivedR1 } from "../../revisions/reset_archived.r1.seed";
import { seed as orderR2 } from "../../revisions/reset_order.r2.seed";
import { seed as reviewR1 } from "../../revisions/reset_review.r1.seed";

/**
 * 夾具「第二版」的 registry:訂購單只登記目前有效的第二版(備註的欄位級權限因此退役),
 * 審核流程與明示退役的表單不變;`reset_leaving` 已不再登記(退出管理)。
 */
export const seedRegistry: SeedRegistry = assembleSeedRegistry(
  fixtureProjectSettings,
  {
    ...fixtureProjectSource,
    seeds: [...fixtureProjectSource.seeds, orderR2, reviewR1, archivedR1],
  },
);
