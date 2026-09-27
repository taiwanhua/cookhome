/**
 * 示範家族的模組 / 權限 key 與路由(正本:`apps/db-migrator/seeds/modules/demo.sub.sample-one.ts`)。
 * 路由是把模組樹上的 `route` 一段段接起來的結果(`demo` / `sub` / `sample-one` / …)。
 */

export const OVERVIEW_MODULE = "overview";
export const DEMO_GROUP = "demo";
export const DEMO_SUB_GROUP = "demo.sub";
export const SAMPLE_ONE = "demo.sub.sample-one";
export const SAMPLE_TWO = "demo.sample-two";

export const SAMPLE_ONE_VIEW_PAGE = `${SAMPLE_ONE}.view-page`;
export const SAMPLE_ONE_CREATE_PAGE = `${SAMPLE_ONE}.create-page`;
export const SAMPLE_ONE_EDIT_PAGE = `${SAMPLE_ONE}.edit-page`;

export const SAMPLE_ONE_WILDCARD = `${SAMPLE_ONE}.*`;
export const SAMPLE_ONE_VIEW = `${SAMPLE_ONE}.view`;
export const SAMPLE_ONE_CREATE = `${SAMPLE_ONE}.create`;
export const SAMPLE_ONE_EDIT = `${SAMPLE_ONE}.edit`;
export const SAMPLE_ONE_DELETE = `${SAMPLE_ONE}.delete`;
export const SAMPLE_ONE_SHOW_INTERNAL_NOTE = `${SAMPLE_ONE}.show-internal-note`;
export const SAMPLE_ONE_EDIT_INTERNAL_NOTE = `${SAMPLE_ONE}.edit-internal-note`;

export const EDIT_PAGE_WILDCARD = `${SAMPLE_ONE_EDIT_PAGE}.*`;
export const EDIT_PAGE_SHOW_HISTORY = `${SAMPLE_ONE_EDIT_PAGE}.show-history`;
export const CREATE_PAGE_SHOW_TIPS = `${SAMPLE_ONE_CREATE_PAGE}.show-tips`;

export const SAMPLE_ONE_LIST_ROUTE = "/demo/sub/sample-one";
export const SAMPLE_ONE_CREATE_ROUTE = `${SAMPLE_ONE_LIST_ROUTE}/create-page`;
export const SAMPLE_ONE_VIEW_ROUTE = `${SAMPLE_ONE_LIST_ROUTE}/view-page`;
export const SAMPLE_ONE_EDIT_ROUTE = `${SAMPLE_ONE_LIST_ROUTE}/edit-page`;

export const SAMPLE_TWO_LIST_ROUTE = "/demo/sample-two";

export const ROLE_MANAGER_ROUTE = "/system/role-manager";
export const DATA_SCOPE_ROUTE = "/system/data-scope";
export const USER_MANAGER_ROUTE = "/system/user-manager";
export const ORG_MANAGER_ROUTE = "/system/org-manager";

/**
 * 資料範圍左清單的副文字(各模組 seed 的 `dataScopeTarget.collection`;目標本身以模組 key 指定)。
 * 示範模組1 有宣告、**示範模組2 沒有** —— 劇本 3 的對照組就是這件事。
 */
export const DEMO_ITEMS_ONE_COLLECTION = "demo_items_one";
export const DEMO_ITEMS_TWO_COLLECTION = "demo_items_two";
