import { ModuleEngine, ModuleSidebarType } from "@repo/graphql";

import type { TestModule } from "../msw/auth-handlers";

/**
 * 測試專案(`jest.config.mjs` 的 `project-fixture`)的模組 key 與 `me.modules` 夾具。
 * 這個專案只存在於測試:正式的 `app/project/` 登記是空的,這些 key 不進 seed、不進 production。
 */
export const PROJECT_REPORT_MODULE_KEY = "project.report";
export const PROJECT_REPORT_ROUTE = "/project/report";

/** 專案自有的表單模組(只驗登記與設定的合成,不渲染)。 */
export const PROJECT_LEAVE_MODULE_KEY = "project.leave";
export const PROJECT_LEAVE_TAB_LABEL_TEMPLATE = "{{applicant}}的{{form}}";

/** 專案新增的模組在 `me.modules` 裡的那一筆(有它才進得去;形狀同 seed 的 link 模組)。 */
export const projectReportModule: TestModule = {
  id: "m-project-report",
  key: PROJECT_REPORT_MODULE_KEY,
  name: "專案報表",
  parentId: null,
  sidebarType: ModuleSidebarType.Link,
  engine: ModuleEngine.Fixed,
  order: 8,
  route: PROJECT_REPORT_ROUTE,
  icon: "list",
  permissions: [`${PROJECT_REPORT_MODULE_KEY}.*`],
};
