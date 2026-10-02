/**
 * 使用者管理的權限 key(正本 `docs/modules/user-manager.md` 權限表;判斷走 ADR-0011「頁內功能」)。
 * 組織樹來自 `orgTree`,而它由 api 掛在 `system.org-manager.view` 底下 —
 * 所以左側樹與「選擇所屬組織」彈窗要額外看這個 key,沒有就退成「整個管理範圍的清單」。
 */
export const USER_MANAGER_MODULE_KEY = "system.user-manager";

export const USER_MANAGER_PERMISSIONS = {
  view: `${USER_MANAGER_MODULE_KEY}.view`,
  create: `${USER_MANAGER_MODULE_KEY}.create`,
  edit: `${USER_MANAGER_MODULE_KEY}.edit`,
  toggleEnabled: `${USER_MANAGER_MODULE_KEY}.toggle-enabled`,
  manageOrgs: `${USER_MANAGER_MODULE_KEY}.manage-orgs`,
  assignRoles: `${USER_MANAGER_MODULE_KEY}.assign-roles`,
  showNationalId: `${USER_MANAGER_MODULE_KEY}.show-national-id`,
  editNationalId: `${USER_MANAGER_MODULE_KEY}.edit-national-id`,
} as const;

/** 組織樹端點的權限(api `orgTree` / `org` 都掛在它底下)。 */
export const ORG_MANAGER_VIEW_PERMISSION = "system.org-manager.view";
