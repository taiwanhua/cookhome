/**
 * 欄位管理的權限 key(正本 `docs/modules/field-manager.md` 權限表;判斷走 ADR-0011「頁內功能」)。
 *
 * 本模組**不是**根組織專屬:每個組織都能自訂自己的選項。只有「種子選項的 enabled」
 * 這一件事限根組織(那是全域開關),見 `isRootPerspective`。
 */
export const FIELD_MANAGER_MODULE_KEY = "system.field-manager";

export const FIELD_MANAGER_PERMISSIONS = {
  view: `${FIELD_MANAGER_MODULE_KEY}.view`,
  create: `${FIELD_MANAGER_MODULE_KEY}.create`,
  edit: `${FIELD_MANAGER_MODULE_KEY}.edit`,
  toggleEnabled: `${FIELD_MANAGER_MODULE_KEY}.toggle-enabled`,
} as const;

/**
 * 根組織專屬模組(seed 的 `isRootOnly`,`apps/db-migrator/seeds/modules/system.ts`)。
 * 租戶管理員模板在開通時會把整枝扣掉(ADR-0009 第 3 步),而防越權讓租戶也無法自己補回來,
 * 所以「`me.modules` 裡出現其中任一項」= 這個人站在根組織。
 */
const ROOT_ONLY_MODULE_KEYS = new Set<string>([
  "system.module-manager",
  "system.data-scope",
  "system.org-manager.tenant-ops",
]);

/**
 * 操作者是不是站在**根組織**視角。
 *
 * 種子選項的 `enabled` 是全域開關(一筆 `orgId = null` 的文件切下去全平台生效),
 * api 因此限根組織操作者,租戶切它回 `FORBIDDEN`(field-manager.md,#206 定案)。
 * 前端要據此把 `GLOBAL` 列的開關設為唯讀,但 `me` 沒有「當前組織是不是根組織」的旗標,
 * 也不能為了問這件事去查 `org(id)`(那要 `system.org-manager.view`,欄位管理的人未必有)。
 *
 * 所以這裡用**根組織專屬模組有沒有出現在 `me.modules`**當判準 —— 資料來源是同一份
 * 已經在手上的 `me`,不多打一次查詢。**它會偏保守**:根組織裡只被授予欄位管理、
 * 一個根組織專屬模組都沒拿到的人,會被當成租戶視角而看到唯讀開關(api 其實會放行)。
 * 真正的把關在 api;這裡只是不要讓人按了才吃 `FORBIDDEN`。有了正式旗標(如
 * `me.currentOrg.isRoot`)之後,只要換掉這個函式。
 */
export const isRootPerspective = (
  moduleKeys: readonly string[] | undefined,
): boolean => moduleKeys?.some((key) => ROOT_ONLY_MODULE_KEYS.has(key)) ?? false;
