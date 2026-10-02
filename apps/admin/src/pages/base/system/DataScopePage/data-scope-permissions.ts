/**
 * 資料範圍的權限 key(正本 `docs/modules/data-scope.md` 權限表;判斷走 ADR-0011「頁內功能」)。
 *
 * 整頁**根組織專屬**(模組 `isRootOnly`):租戶連側欄都沒有這一項,所以前端不做「是不是根組織」
 * 的判斷 — 站在哪裡由 api 守(`OwnerProtectionService.isRootOperator`),前端只管「有沒有這筆權限」。
 */
export const DATA_SCOPE_MODULE_KEY = "system.data-scope";

export const DATA_SCOPE_PERMISSIONS = {
  view: `${DATA_SCOPE_MODULE_KEY}.view`,
  edit: `${DATA_SCOPE_MODULE_KEY}.edit`,
} as const;

/**
 * 套用對象(指定角色 / 指定使用者)的選擇器借用別的模組的清單查詢,所以要各自的檢視權限。
 * 沒有時該選擇器是空清單並說明原因,頁面其餘部分照常(反向引用的寫法同 #138 / #139)。
 * 組織樹(`orgTree`)沒有 `@RequirePermission`,只受管理範圍限制,不必在這裡判斷。
 */
export const ROLE_MANAGER_VIEW_PERMISSION = "system.role-manager.view";

export const USER_MANAGER_VIEW_PERMISSION = "system.user-manager.view";
