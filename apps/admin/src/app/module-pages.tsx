import { formModulePages } from "../components/form-engine/FormModulePages/form-module-pages";
import { OverviewPage } from "../pages/OverviewPage/OverviewPage";
import { ApplyCenterPage } from "../pages/apply-center/ApplyCenterPage/ApplyCenterPage";
import {
  APPLY_CENTER_MODULE_KEY,
  APPLY_CENTER_VIEW_PAGE_KEY,
} from "../pages/apply-center/apply-center-keys";
import { LazyApplyCenterViewPage } from "../pages/apply-center/lazy-apply-center-view-page";
import { SampleOneFormPage } from "../pages/demo/SampleOneFormPage/SampleOneFormPage";
import { SampleOnePage } from "../pages/demo/SampleOnePage/SampleOnePage";
import { SampleOneViewPage } from "../pages/demo/SampleOneViewPage/SampleOneViewPage";
import { SampleTwoFormPage } from "../pages/demo/SampleTwoPage/SampleTwoFormPage";
import { SampleTwoPage } from "../pages/demo/SampleTwoPage/SampleTwoPage";
import { SampleTwoViewPage } from "../pages/demo/SampleTwoPage/SampleTwoViewPage";
import { SAMPLE_ONE_MODULE_KEYS } from "../pages/demo/demo-sample-one-config";
import { SAMPLE_TWO_MODULE_KEYS } from "../pages/demo/demo-sample-two-config";
import { DataScopePage } from "../pages/system/DataScopePage/DataScopePage";
import { DATA_SCOPE_MODULE_KEY } from "../pages/system/DataScopePage/data-scope-permissions";
import { FieldManagerPage } from "../pages/system/FieldManagerPage/FieldManagerPage";
import { FIELD_MANAGER_MODULE_KEY } from "../pages/system/FieldManagerPage/field-manager-permissions";
import { FORMS_MODULE_KEY } from "../pages/system/FormsPage/forms-permissions";
import { LazyFormsPage } from "../pages/system/FormsPage/lazy-forms-page";
import { ModuleManagerPage } from "../pages/system/ModuleManagerPage/ModuleManagerPage";
import { MODULE_MANAGER_MODULE_KEY } from "../pages/system/ModuleManagerPage/module-manager-permissions";
import { OrgManagerPage } from "../pages/system/OrgManagerPage/OrgManagerPage";
import { ORG_MANAGER_MODULE_KEY } from "../pages/system/OrgManagerPage/org-manager-permissions";
import { RoleManagerPage } from "../pages/system/RoleManagerPage/RoleManagerPage";
import { ROLE_MANAGER_MODULE_KEY } from "../pages/system/RoleManagerPage/role-manager-permissions";
import { UserManagerPage } from "../pages/system/UserManagerPage/UserManagerPage";
import { USER_MANAGER_MODULE_KEY } from "../pages/system/UserManagerPage/user-manager-permissions";
import { WorkflowBlockedPage } from "../pages/system/WorkflowBlockedPage/WorkflowBlockedPage";
import { LazyWorkflowsPage } from "../pages/system/WorkflowsPage/lazy-workflows-page";
import {
  WORKFLOWS_BLOCKED_PAGE_KEY,
  WORKFLOWS_MODULE_KEY,
} from "../pages/system/workflows-permissions";
import type { ModulePageRegistry } from "./guards/ModuleRoute/ModuleRoute";

/** 總覽模組 key(seed 正本:apps/db-migrator/seeds/modules/overview.ts;admin 不能 import db-migrator,STRUCT-01)。 */
export const OVERVIEW_MODULE_KEY = "overview";

/** 購物清單:表單模組範例(seed 正本 apps/db-migrator/seeds/modules/shopping-list.ts,`engine: "form"`)。 */
export const SHOPPING_LIST_MODULE_KEY = "shopping-list";

/** 請假:綁審核流程的表單模組範例(seed 正本 apps/db-migrator/seeds/modules/leave.ts,`engine: "form"`)。 */
export const LEAVE_MODULE_KEY = "leave";

/**
 * 模組 key → 頁面元件(組裝層,STRUCT-03):各模組實作時在此登記;
 * 沒登記的模組由殼顯示佔位頁(模組名)。路由本身仍由 `me.modules` 決定,這裡只決定「進去看到什麼」。
 */
export const modulePages: ModulePageRegistry = {
  [OVERVIEW_MODULE_KEY]: OverviewPage,
  // 示範模組1 四個 key = 四頁(#320);新增與編輯是**同一個共版型元件**,情境由 `module.key` 判斷
  [SAMPLE_ONE_MODULE_KEYS.list]: SampleOnePage,
  [SAMPLE_ONE_MODULE_KEYS.viewPage]: SampleOneViewPage,
  [SAMPLE_ONE_MODULE_KEYS.createPage]: SampleOneFormPage,
  [SAMPLE_ONE_MODULE_KEYS.editPage]: SampleOneFormPage,
  // 示範模組2 四個 key = 四頁(#321);與示範模組1 同一組共用元件,差別只在設定物件
  [SAMPLE_TWO_MODULE_KEYS.list]: SampleTwoPage,
  [SAMPLE_TWO_MODULE_KEYS.viewPage]: SampleTwoViewPage,
  [SAMPLE_TWO_MODULE_KEYS.createPage]: SampleTwoFormPage,
  [SAMPLE_TWO_MODULE_KEYS.editPage]: SampleTwoFormPage,
  [ORG_MANAGER_MODULE_KEY]: OrgManagerPage,
  [MODULE_MANAGER_MODULE_KEY]: ModuleManagerPage,
  [FIELD_MANAGER_MODULE_KEY]: FieldManagerPage,
  [USER_MANAGER_MODULE_KEY]: UserManagerPage,
  [ROLE_MANAGER_MODULE_KEY]: RoleManagerPage,
  [DATA_SCOPE_MODULE_KEY]: DataScopePage,
  // 表單管理:懶載入(設計器不進首屏 bundle)
  [FORMS_MODULE_KEY]: LazyFormsPage,
  // 審核流程(Spec 6b §8):流程管理(設計器懶載入)與阻擋清單、申請中心兩頁籤與詳情(詳情懶載入)
  [WORKFLOWS_MODULE_KEY]: LazyWorkflowsPage,
  [WORKFLOWS_BLOCKED_PAGE_KEY]: WorkflowBlockedPage,
  [APPLY_CENTER_MODULE_KEY]: ApplyCenterPage,
  [APPLY_CENTER_VIEW_PAGE_KEY]: LazyApplyCenterViewPage,
  // 表單模組(Spec 6a §8「登記與客製」):四個 key 全用表單引擎的預設組裝;
  // 請假綁了流程時,詳情頁下方自動掛審核區塊(預設組裝含)
  ...formModulePages(SHOPPING_LIST_MODULE_KEY),
  ...formModulePages(LEAVE_MODULE_KEY),
};
