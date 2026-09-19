import type { ModuleAdminNodeLike } from "./module-manager-types";

/**
 * `moduleTree` 的走訪工具(只有本頁用,所以留在頁面資料夾而不是 `lib/`,STRUCT-03)。
 * `children` 在最深一層的 codegen 型別上不存在,一律以 `?? []` 取用。
 */

/** 深度優先攤平整棵樹,順序 = 畫面上的順序。 */
export const flattenModules = (
  nodes: readonly ModuleAdminNodeLike[],
): ModuleAdminNodeLike[] =>
  nodes.flatMap((node) => [node, ...flattenModules(node.children ?? [])]);

/** 所有節點 id(樹的展開狀態用全集表示)。 */
export const allModuleIds = (nodes: readonly ModuleAdminNodeLike[]): string[] =>
  flattenModules(nodes).map((node) => node.id);

/** 依 id 找節點(含它的子樹);找不到回 null。 */
export const findModuleNode = (
  nodes: readonly ModuleAdminNodeLike[],
  id: string,
): ModuleAdminNodeLike | null => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    const deeper = findModuleNode(node.children ?? [], id);
    if (deeper !== null) {
      return deeper;
    }
  }
  return null;
};

/** 預設選中的節點 = 第一棵樹的根;空樹回 null。 */
export const firstModuleId = (
  nodes: readonly ModuleAdminNodeLike[],
): string | null => nodes[0]?.id ?? null;

/**
 * 權限的顯示順序:`<模組 key>.*` 恆排最前,其餘依 key
 * (`docs/modules/module-manager.md`「回傳欄位語意」— api 已照這個順序回,
 * 這裡再排一次是為了不讓夾具或快取的順序決定畫面)。
 */
export const sortPermissions = <T extends { key: string }>(
  permissions: readonly T[],
): T[] =>
  permissions.toSorted((left, right) => {
    const leftIsAll = left.key.endsWith(".*");
    const rightIsAll = right.key.endsWith(".*");
    if (leftIsAll !== rightIsAll) {
      return leftIsAll ? -1 : 1;
    }
    return left.key.localeCompare(right.key);
  });
