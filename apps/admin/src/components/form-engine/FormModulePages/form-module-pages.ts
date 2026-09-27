import { type ComponentType, lazy } from "react";

import type { ModulePageProps } from "@/lib/module-tree";

import {
  type FormModuleOptions,
  registerFormModule,
} from "./form-module-options";
import { FORM_MODULE_PAGE_SUFFIXES } from "./useFormModuleAccess";

/**
 * 四頁各自懶載入(`React.lazy`,Suspense 在 `ModuleRoute`):表單引擎(渲染器、JSONLogic / decimal 計算器、
 * widget)只有進到表單模組才需要,不進首屏 bundle。模組層常數,身分固定(不在 render 內建立)。
 */
const FormListPage = lazy(() =>
  import("./FormListPage").then((module) => ({ default: module.FormListPage })),
);
const FormViewPage = lazy(() =>
  import("./FormViewPage").then((module) => ({ default: module.FormViewPage })),
);
const FormCreatePage = lazy(() =>
  import("./FormCreatePage").then((module) => ({
    default: module.FormCreatePage,
  })),
);
const FormEditPage = lazy(() =>
  import("./FormEditPage").then((module) => ({ default: module.FormEditPage })),
);

/**
 * 表單模組的預設組裝(Spec 6a §8「登記與客製」):產出四個 key 的預設元件,在 `app/module-pages.tsx` 展開。
 *
 * ```ts
 * ...formModulePages(SHOPPING_LIST_KEY),                          // 四頁全用預設
 * ...formModulePages(LEAVE_KEY), [LEAVE_KEY]: LeavePage,          // 列表頁客製、其餘預設
 * [LEAVE_KEY]: LeavePage, [`${LEAVE_KEY}.view-page`]: LeaveViewPage, // 全部自己來
 * ```
 *
 * 四個元件都是模組層常數(不是每次呼叫各建一份,REACT-09 的同一個理由);它們從 `module.key` 反推模組 key,
 * 模組層設定(頁籤模板)在這裡登記、頁面執行時讀。客製頁把表單零件(`FormRenderer`、`FormSubmissionList`…)
 * 綁進自己的版面即可。
 */
export const formModulePages = (
  moduleKey: string,
  options: FormModuleOptions = {},
): Record<string, ComponentType<ModulePageProps>> => {
  registerFormModule(moduleKey, options);
  return {
    [moduleKey]: FormListPage,
    [`${moduleKey}.${FORM_MODULE_PAGE_SUFFIXES.viewPage}`]: FormViewPage,
    [`${moduleKey}.${FORM_MODULE_PAGE_SUFFIXES.createPage}`]: FormCreatePage,
    [`${moduleKey}.${FORM_MODULE_PAGE_SUFFIXES.editPage}`]: FormEditPage,
  };
};
