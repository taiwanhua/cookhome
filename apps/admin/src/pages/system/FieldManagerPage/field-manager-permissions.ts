/**
 * 欄位管理的權限 key(正本 `docs/modules/field-manager.md` 權限表;判斷走 ADR-0011「頁內功能」)。
 *
 * 本模組**不是**根組織專屬:每個組織都能自訂自己的選項。
 *
 * 「這一列能不能按」除了權限還要看組織關係(種子 / 上層 / 自己 / 下層),那一半由 **api**
 * 逐列算好成 `canEdit` / `canToggleEnabled`(#264),前端只跟權限取交集 —— 見 `field-source.ts`。
 */
export const FIELD_MANAGER_MODULE_KEY = "system.field-manager";

export const FIELD_MANAGER_PERMISSIONS = {
  view: `${FIELD_MANAGER_MODULE_KEY}.view`,
  create: `${FIELD_MANAGER_MODULE_KEY}.create`,
  edit: `${FIELD_MANAGER_MODULE_KEY}.edit`,
  toggleEnabled: `${FIELD_MANAGER_MODULE_KEY}.toggle-enabled`,
} as const;
