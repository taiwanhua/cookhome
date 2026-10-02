import { assembleSeedRegistry } from "../../../seeds/registry";
import type { SeedRegistry } from "../../../src/seed/seed-declaration";
import {
  fixtureProjectSettings,
  fixtureProjectSource,
} from "../seeds-project/project-source";
import { seed as projectRequest } from "./revisions/project_request.r1.seed";
import { seed as projectReview } from "./revisions/project_review.r1.seed";

/**
 * 夾具 registry:專案來源另外登記兩份版本化定義(`revisions/` 底下是 `serializeSeedSet` 的原始輸出,
 * 像設計器匯出後直接放進 repo 的檔案)。流程刻意登記在它引用的表單前面:順序由組裝排。
 */
export const seedRegistry: SeedRegistry = assembleSeedRegistry(
  fixtureProjectSettings,
  {
    ...fixtureProjectSource,
    seeds: [...fixtureProjectSource.seeds, projectReview, projectRequest],
  },
);
