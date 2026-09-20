/**
 * 角色選單的顯示與分組(#261 的 8)。
 *
 * 三個地方要能**分辨同名角色** —— 資料範圍頁的套用對象「指定角色」、使用者頁的指派角色、
 * 角色管理頁的清單:每個租戶都有自己的「租戶管理員」,只看角色名稱在根組織視角完全分不出來。
 *
 * 兩層做法,資料都來自 `Role.ownerOrg`(api 已備妥,見 `docs/modules/role-manager.md`):
 * - 每一列標「角色名稱 — 擁有組織名稱」
 * - 跨到兩個以上的租戶頂層時再依 `ownerOrg.tenantTop` 分組(單一租戶視角不分組 —
 *   只有一組的標題是雜訊)
 */

/** 這些函式只吃 `Role` 的這幾個欄位;各頁的 codegen 型別結構上相容,不必轉一手。 */
export interface RoleOptionSource {
  id: string;
  name: string;
  ownerOrg?: {
    id: string;
    name: string;
    tenantTop?: { id: string; name: string } | null;
  } | null;
}

/** 選單的一列。 */
export interface RoleMenuOption {
  id: string;
  name: string;
  /** 擁有組織名稱;資料損毀(無 `org_role`)或範圍外時為 null */
  ownerOrgName: string | null;
  /** 「角色名稱 — 擁有組織」;沒有擁有組織時只有角色名稱 */
  label: string;
  /** 分組用的租戶頂層;擁有組織是根組織(種子角色)時為 null */
  tenantTopId: string | null;
  tenantTopName: string | null;
}

/** 分組後的一組;`id` 為 null = 不屬於任何租戶(種子角色那一組)。 */
export interface RoleMenuGroup {
  id: string | null;
  name: string | null;
  options: RoleMenuOption[];
}

/** 「角色名稱 — 擁有組織」;破折號用全形,與清單列 / Figma 一致。 */
export const roleOptionLabel = (
  name: string,
  ownerOrgName: string | null,
): string => (ownerOrgName === null ? name : `${name} — ${ownerOrgName}`);

export const roleMenuOptionOf = (role: RoleOptionSource): RoleMenuOption => {
  const ownerOrgName = role.ownerOrg?.name ?? null;
  const tenantTop = role.ownerOrg?.tenantTop ?? null;
  return {
    id: role.id,
    name: role.name,
    ownerOrgName,
    label: roleOptionLabel(role.name, ownerOrgName),
    tenantTopId: tenantTop?.id ?? null,
    tenantTopName: tenantTop?.name ?? null,
  };
};

export const roleMenuOptions = (
  roles: readonly RoleOptionSource[],
): RoleMenuOption[] => roles.map((role) => roleMenuOptionOf(role));

/**
 * 依租戶頂層分組;**只有跨兩個以上租戶時才分**(根組織視角),否則回單一組(`id` 為 null)。
 * 組的順序 = 各組第一次出現的順序(= api 回的順序),沒有租戶頂層的一組殿後。
 */
export const groupRoleOptions = (
  options: readonly RoleMenuOption[],
): RoleMenuGroup[] => {
  const tenantTopIds = new Set(
    options.flatMap((option) =>
      option.tenantTopId === null ? [] : [option.tenantTopId],
    ),
  );
  if (tenantTopIds.size < 2) {
    return [{ id: null, name: null, options: [...options] }];
  }
  const groups = new Map<string, RoleMenuGroup>();
  const ungrouped: RoleMenuOption[] = [];
  for (const option of options) {
    if (option.tenantTopId === null) {
      ungrouped.push(option);
      continue;
    }
    const group = groups.get(option.tenantTopId) ?? {
      id: option.tenantTopId,
      name: option.tenantTopName,
      options: [],
    };
    group.options.push(option);
    groups.set(option.tenantTopId, group);
  }
  return [
    ...groups.values(),
    ...(ungrouped.length === 0
      ? []
      : [{ id: null, name: null, options: ungrouped }]),
  ];
};

/** 關鍵字過濾:比對角色名稱與擁有組織名稱(不分大小寫);空白關鍵字原樣回傳。 */
export const filterRoleOptions = <T extends { name: string; ownerOrgName: string | null }>(
  options: readonly T[],
  keyword: string,
): T[] => {
  const needle = keyword.trim().toLowerCase();
  if (needle === "") {
    return [...options];
  }
  return options.filter(
    (option) =>
      option.name.toLowerCase().includes(needle) ||
      (option.ownerOrgName ?? "").toLowerCase().includes(needle),
  );
};
