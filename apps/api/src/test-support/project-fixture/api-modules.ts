import type { ApiFeatureRegistration } from "../../base/api-feature-registration";
import { ProjectFixtureModule } from "./project-fixture.module";

/** 測試專案的功能清單(測試以它頂替 `project/api-modules.ts` 的內容)。 */
export const PROJECT_FIXTURE_API_MODULES: readonly ApiFeatureRegistration[] = [
  { key: "project-fixture", module: ProjectFixtureModule },
];
