import type { TenantModuleOption } from "../org-manager-types";

/** 勾選清單的一列:模組本身 + 它在清單裡的深度(縮排用)。 */
export interface ModuleRow {
  option: TenantModuleOption;
  depth: number;
}

/**
 * 依 `parentId` 與 `order` 把扁平的模組清單排成「樹的前序」。
 * `parentId` 不在清單內(根組織專屬模組被扣掉時會發生)的節點自成一棵根,所以不會漏掉任何一列。
 */
export const toModuleRows = (
  options: readonly TenantModuleOption[],
): ModuleRow[] => {
  const ids = new Set(options.map((option) => option.id));
  const childrenOf = new Map<string | null, TenantModuleOption[]>();
  for (const option of options) {
    const parentId =
      option.parentId !== null &&
      option.parentId !== undefined &&
      ids.has(option.parentId)
        ? option.parentId
        : null;
    childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), option]);
  }

  const walk = (parentId: string | null, depth: number): ModuleRow[] =>
    (childrenOf.get(parentId) ?? [])
      .toSorted((left, right) => left.order - right.order)
      .flatMap((option) => [{ option, depth }, ...walk(option.id, depth + 1)]);

  return walk(null, 0);
};

/** 每個模組的上層鏈(由近到遠);上層不在清單內就停。 */
const ancestorsOf = (rows: readonly ModuleRow[], id: string): string[] => {
  const byId = new Map(rows.map((row) => [row.option.id, row.option]));
  const trail: string[] = [];
  let current = byId.get(id)?.parentId ?? null;
  while (current !== null && byId.has(current)) {
    trail.push(current);
    current = byId.get(current)?.parentId ?? null;
  }
  return trail;
};

/** 某個模組的整棵下層(含自己)。 */
const subtreeOf = (rows: readonly ModuleRow[], id: string): string[] => {
  const childrenOf = new Map<string, string[]>();
  for (const { option } of rows) {
    if (option.parentId !== null && option.parentId !== undefined) {
      childrenOf.set(option.parentId, [
        ...(childrenOf.get(option.parentId) ?? []),
        option.id,
      ]);
    }
  }
  const collect = (current: string): string[] => [
    current,
    ...(childrenOf.get(current) ?? []).flatMap((child) => collect(child)),
  ];
  return collect(id);
};

/**
 * 勾選連動(ADR-0004「勾下層模組必連動勾上層」,規則同角色管理的矩陣):
 * - **勾起來** → 連同所有上層一起勾:模組樹就是側欄的樹,只綁下層不綁群組會讓側欄斷成孤兒
 * - **取消勾選** → 連同整棵下層一起取消:上層沒開放,下層開放了也走不到
 *
 * 回傳新的 Set(不就地改,REACT-06 `immutability`)。
 */
export const toggleModule = (
  selectedIds: ReadonlySet<string>,
  rows: readonly ModuleRow[],
  id: string,
  isChecked: boolean,
): Set<string> => {
  const next = new Set(selectedIds);
  if (isChecked) {
    next.add(id);
    for (const ancestor of ancestorsOf(rows, id)) {
      next.add(ancestor);
    }
    return next;
  }
  for (const descendant of subtreeOf(rows, id)) {
    next.delete(descendant);
  }
  return next;
};

/** 自己勾了、但下層沒有全勾 → 半選(讓「群組開了一半」看得出來)。 */
export const isIndeterminate = (
  selectedIds: ReadonlySet<string>,
  rows: readonly ModuleRow[],
  id: string,
): boolean => {
  if (!selectedIds.has(id)) {
    return false;
  }
  const subtree = subtreeOf(rows, id);
  return subtree.length > 1 && subtree.some((item) => !selectedIds.has(item));
};

/** 選中的模組 id → 送給 api 的 `moduleKeys`(順序照清單,方便測試斷言)。 */
export const moduleKeysOf = (
  selectedIds: ReadonlySet<string>,
  rows: readonly ModuleRow[],
): string[] =>
  rows
    .filter((row) => selectedIds.has(row.option.id))
    .map((row) => row.option.key);
