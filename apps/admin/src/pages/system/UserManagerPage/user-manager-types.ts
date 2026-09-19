import type { SetUserOrgsMutation, UsersQuery } from "@repo/graphql";

/** 清單的一列(`users` query 的 item;欄位見 `packages/graphql/src/documents/users.graphql`)。 */
export type UserRow = UsersQuery["users"]["items"][number];

export type UserOrgRef = UserRow["orgs"][number];
export type UserRoleGrant = UserRow["roles"][number];

/** `setUserOrgs` 的回應:`dryRun: true` 時只有 `removedOrgs` / `unqualifiedRoles` 有意義。 */
export type SetUserOrgsResult = SetUserOrgsMutation["setUserOrgs"];

/** 頁面上可執行的動作,依權限與擁有者保護決定是否顯示 / 停用。 */
export interface UserActionAbility {
  canCreate: boolean;
  canEdit: boolean;
  canManageOrgs: boolean;
  canAssignRoles: boolean;
  canToggleEnabled: boolean;
  canShowNationalId: boolean;
  canEditNationalId: boolean;
}

/** 清單每頁筆數(api 上限 100;設計稿頁尾寫「每頁 N 筆」)。 */
export const USERS_PAGE_SIZE = 10;
