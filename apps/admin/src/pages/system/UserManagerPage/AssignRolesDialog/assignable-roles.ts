import type { RolesQuery } from "@repo/graphql";

import type { UserRoleGrant } from "../user-manager-types";

/** `roles` query 的一筆(擁有組織在操作者**管理範圍**內;role-manager.md「api 介面」)。 */
export type AssignableRole = RolesQuery["roles"]["items"][number];

/** 指派角色彈窗的一列。 */
export interface RoleOption {
  id: string;
  name: string;
  description: string | null;
  ownerOrgId: string | null;
  ownerOrgName: string | null;
  /** 角色本身已停用:持有者拿不到它的權限(ADR-0011 步驟 2),所以不給新勾 */
  enabled: boolean;
  /** 開通租戶時複製出來的副本(ADR-0009);列上掛一個標籤讓人分得出來 */
  isTemplateCopy: boolean;
  /** 目標使用者目前已持有 */
  isGranted: boolean;
  /** 不在操作者管理範圍內(只會是「對方已持有、我搆不到」的既有授予)→ 唯讀 */
  isOutOfReach: boolean;
  /** 已授予但使用者不在該角色擁有組織的子樹內(「組織外」) */
  isOutOfScope: boolean;
}

/**
 * 清單 = `roles` query 回的角色(可勾)∪ 目標使用者已被授予的角色(管理範圍外的唯讀顯示)。
 *
 * 候選來自正式的 `roles` query —— 範圍是「擁有組織在操作者管理範圍內」,與 api 的
 * `assignUserRoles` 同一條判準(#211 起與 `grantRoleUsers` 統一;第 3 段「查操作者自己
 * 持有的角色」的過渡做法退場)。管理範圍外的既有授予仍要列出來:api 的全量覆蓋
 * 只作用在操作者觸及得到的角色上,列不出來的就不該被順手解除(user-manager.md
 * 「全量覆蓋的邊界」)。
 */
export const buildRoleOptions = (
  assignable: readonly AssignableRole[],
  targetRoles: readonly UserRoleGrant[],
): RoleOption[] => {
  const grants = new Map(targetRoles.map((role) => [role.id, role]));
  const options = assignable.map<RoleOption>((role) => ({
    id: role.id,
    name: role.name,
    description: role.description ?? null,
    ownerOrgId: role.ownerOrg?.id ?? null,
    ownerOrgName: role.ownerOrg?.name ?? null,
    enabled: role.enabled,
    isTemplateCopy: role.isTemplateCopy,
    isGranted: grants.has(role.id),
    isOutOfReach: false,
    isOutOfScope: grants.get(role.id)?.outOfScope ?? false,
  }));

  const reachable = new Set(assignable.map((role) => role.id));
  const outOfReach = targetRoles
    .filter((role) => !reachable.has(role.id))
    .map<RoleOption>((role) => ({
      id: role.id,
      name: role.name,
      description: null,
      ownerOrgId: role.ownerOrgId ?? null,
      ownerOrgName: role.ownerOrgName ?? null,
      // 搆不到的角色只從授予記錄得知,沒有 enabled / isTemplateCopy 可言
      enabled: true,
      isTemplateCopy: false,
      isGranted: true,
      isOutOfReach: true,
      isOutOfScope: role.outOfScope,
    }));

  return [...options, ...outOfReach];
};

/**
 * 這一列能不能被勾動:管理範圍外一律唯讀;**已停用的角色不可新勾**,
 * 但已經持有的還要能取消(不然停用的角色就永遠拔不掉了)。
 */
export const isRoleSelectable = (
  role: RoleOption,
  isChecked: boolean,
): boolean => !role.isOutOfReach && (role.enabled || isChecked);

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
