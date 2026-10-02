import type { ModulePageSource } from "../../app/module-page-registry";
import {
  PROJECT_LEAVE_MODULE_KEY,
  PROJECT_LEAVE_TAB_LABEL_TEMPLATE,
  PROJECT_REPORT_MODULE_KEY,
} from "./project-fixture-modules";
import { ProjectReportPage } from "./project-report-page";

/**
 * `app/project/module-pages.ts` 的測試專案版(jest 的 `project-fixture` 以 `moduleNameMapper` 換掉):
 * 一個新增的固定頁 + 一個專案自有的表單模組。其餘組裝(`app/module-pages.tsx`)、路由、守門、殼都是真的。
 */
export const projectModulePages: ModulePageSource = {
  pages: [{ key: PROJECT_REPORT_MODULE_KEY, Page: ProjectReportPage }],
  forms: [
    {
      moduleKey: PROJECT_LEAVE_MODULE_KEY,
      options: { tabLabelTemplate: PROJECT_LEAVE_TAB_LABEL_TEMPLATE },
    },
  ],
};
