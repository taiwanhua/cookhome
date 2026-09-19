import type { UserRoleGrant } from "../user-manager-types";

/** 指派角色彈窗的一列。 */
export interface RoleOption {
  id: string;
  name: string;
  ownerOrgId: string | null;
  ownerOrgName: string | null;
  /** 目標使用者目前已持有 */
  isGranted: boolean;
  /** 操作者自己沒有這個角色 → 不可勾(防越權,ADR-0003:`ROLE_OUT_OF_REACH`) */
  isOutOfReach: boolean;
  /** 已授予但使用者不在該角色擁有組織的子樹內(「組織外」) */
  isOutOfScope: boolean;
}

/**
 * 清單 = 操作者自己持有的角色(可勾)∪ 目標使用者已被授予的角色(觸及不到的那些唯讀顯示)。
 * api 的 `assignUserRoles` 是「只覆蓋操作者可觸及的角色」,所以觸及不到的既有授予
 * 只呈現、不送出,也不會被順手移除(user-manager.md「全量覆蓋的邊界」)。
 */
export const buildRoleOptions = (
  operatorRoles: readonly UserRoleGrant[],
  targetRoles: readonly UserRoleGrant[],
): RoleOption[] => {
  const reachable = new Set(operatorRoles.map((role) => role.id));
  const grants = new Map(targetRoles.map((role) => [role.id, role]));
  const merged = new Map<string, UserRoleGrant>();
  for (const role of [...operatorRoles, ...targetRoles]) {
    merged.set(role.id, merged.get(role.id) ?? role);
  }

  return [...merged.values()].map((role) => ({
    id: role.id,
    name: role.name,
    ownerOrgId: role.ownerOrgId ?? null,
    ownerOrgName: role.ownerOrgName ?? null,
    isGranted: grants.has(role.id),
    isOutOfReach: !reachable.has(role.id),
    isOutOfScope: grants.get(role.id)?.outOfScope ?? false,
  }));
};

/** 篩選器的組織選項(去重、保順序);沒有擁有組織的角色歸在 `null` 不進選單。 */
export const ownerOrgOptions = (
  roles: readonly RoleOption[],
): { id: string; name: string }[] => {
  const seen = new Map<string, string>();
  for (const role of roles) {
    if (role.ownerOrgId !== null && !seen.has(role.ownerOrgId)) {
      seen.set(role.ownerOrgId, role.ownerOrgName ?? role.ownerOrgId);
    }
  }
  return [...seen].map(([id, name]) => ({ id, name }));
};
