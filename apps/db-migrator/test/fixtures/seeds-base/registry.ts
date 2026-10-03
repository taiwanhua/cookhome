import { assembleSeedRegistry } from "../../../seeds/registry";
import type { SeedRegistry } from "../../../src/seed/seed-declaration";
import {
  baseOnlyProjectSettings,
  baseOnlyProjectSource,
} from "./project-source";

/** 夾具 registry:底座 + 空的專案來源,經正式的固定組裝入口合成(與 `seeds/registry.ts` 同一條路)。 */
export const seedRegistry: SeedRegistry = assembleSeedRegistry(
  baseOnlyProjectSettings,
  baseOnlyProjectSource,
);
