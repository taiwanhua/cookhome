/**
 * 組織管理的權限 key(正本 `docs/modules/org-manager.md` 權限表;判斷走 ADR-0011「頁內功能」)。
 *
 * `tenant-ops.*` 是**隱藏的子模組**(`isRootOnly`,無路由):開通租戶、轉移擁有者、設定可見範圍
 * 是根組織專屬動作,放在自己的模組裡,租戶管理員模板複製時整個模組被扣除(ADR-0009 第 3 步),
 * 所以租戶拿到 `system.org-manager.*` 也不會連帶拿到這三筆。彈窗仍然開在組織管理頁上。
 */
export const ORG_MANAGER_MODULE_KEY = "system.org-manager";

const TENANT_OPS_MODULE_KEY = `${ORG_MANAGER_MODULE_KEY}.tenant-ops`;

export const ORG_MANAGER_PERMISSIONS = {
  view: `${ORG_MANAGER_MODULE_KEY}.view`,
  createChild: `${ORG_MANAGER_MODULE_KEY}.create-child`,
  edit: `${ORG_MANAGER_MODULE_KEY}.edit`,
  toggleEnabled: `${ORG_MANAGER_MODULE_KEY}.toggle-enabled`,
  move: `${ORG_MANAGER_MODULE_KEY}.move`,
  delete: `${ORG_MANAGER_MODULE_KEY}.delete`,
  provision: `${TENANT_OPS_MODULE_KEY}.provision`,
  transferOwner: `${TENANT_OPS_MODULE_KEY}.transfer-owner`,
  setVisibility: `${TENANT_OPS_MODULE_KEY}.set-visibility`,
} as const;

/**
 * 使用者清單的權限(api `users` / `user` 都掛在它底下)。
 * 本頁只為了兩件事要它:擁有者欄位顯示名字、轉移擁有者的候選人清單。
 * 沒有它時那兩處退成「看不到名字 / 不能轉移」,頁面其餘部分照常(寫法同 #139 的反向引用)。
 */
export const USER_MANAGER_VIEW_PERMISSION = "system.user-manager.view";
