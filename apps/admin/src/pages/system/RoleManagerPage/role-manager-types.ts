import type {
  RoleMatrixQuery,
  RoleUsersQuery,
  RolesQuery,
} from "@repo/graphql";

/** 清單的一列(`roles` query 的 item;欄位語意見 `docs/modules/role-manager.md`「api 介面」)。 */
export type RoleRow = RolesQuery["roles"]["items"][number];

/** `roleMatrix` / `saveRoleMatrix` 的回應(兩者同一個 payload)。 */
export type RoleMatrixResult = RoleMatrixQuery["roleMatrix"];

/** 分配使用者清單的一列。 */
export type RoleUserRow = RoleUsersQuery["roleUsers"]["items"][number];

/**
 * 矩陣顯示樹的最小節點:codegen 的巢狀四層各是不同型別,但形狀一致,
 * 結構上可直接當 `@repo/domain/permission` 的 `MatrixModuleNode` 餵進連動函式
 * (role-manager.md「矩陣的兩棵樹」:顯示與計算用同一棵)。
 */
export interface MatrixModuleView {
  key: string;
  name: string;
  permissions: readonly { key: string; name: string; action: string }[];
  children?: readonly MatrixModuleView[];
}

/** 單一角色的兩個頁籤。 */
export type RoleDetailTab = "matrix" | "users";

/** 頁面上可執行的動作,依權限決定是否顯示。 */
export interface RoleActionAbility {
  /** 沒有它整頁進不去內容(role-manager.md 權限表) */
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canEditMatrix: boolean;
  canAssignUsers: boolean;
  canToggleEnabled: boolean;
  canDelete: boolean;
}

/** 角色清單每頁筆數(api 上限 100;設計稿頁尾寫「每頁 N 筆」)。 */
export const ROLES_PAGE_SIZE = 10;

/** 分配使用者清單每頁筆數。 */
export const ROLE_USERS_PAGE_SIZE = 10;

/** 「加入使用者」彈窗的候選清單每頁筆數(彈窗不分頁,只取前 N 筆 + 搜尋收斂)。 */
export const ROLE_USER_CANDIDATES_PAGE_SIZE = 20;
