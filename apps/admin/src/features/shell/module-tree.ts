import { type MeQuery, ModuleSidebarType } from "@repo/graphql";

/** `me.modules` 的單筆(ADR-0011 步驟 7:route 為完整路徑、api 樹 route 為 null、permissions 為完整 key)。 */
export type ShellModule = MeQuery["me"]["modules"][number];

export interface NavNode {
  module: ShellModule;
  children: NavNode[];
}

/** 同層排序:order → key(ADR-0011:陣列順序不可信,前端仍以 parentId 組樹後自行排序)。 */
function byOrder(a: ShellModule, b: ShellModule): number {
  return a.order - b.order || a.key.localeCompare(b.key);
}

/** 進得了側欄的節點:有路由,且不是隱藏頁(api 樹 route 為 null,一併略過)。 */
function isSidebarVisible(module: ShellModule): boolean {
  return (
    module.route !== null &&
    module.route !== undefined &&
    module.sidebarType !== ModuleSidebarType.Hidden
  );
}

/**
 * 模組陣列 → 側欄樹(ADR-0011「前端判斷 / 側欄」):以 parentId 組樹,group 可展開、link 為連結、hidden 不顯示。
 * 父節點不在陣列內(或父節點本身不可見)的模組視為根節點,不會憑空消失。
 */
export function buildNavTree(modules: readonly ShellModule[]): NavNode[] {
  const visible = modules.filter((module) => isSidebarVisible(module));
  const visibleIds = new Set(visible.map((module) => module.id));
  const childrenOf = new Map<string | null, ShellModule[]>();

  for (const module of visible) {
    const parentId =
      module.parentId !== null &&
      module.parentId !== undefined &&
      visibleIds.has(module.parentId)
        ? module.parentId
        : null;
    const siblings = childrenOf.get(parentId) ?? [];
    siblings.push(module);
    childrenOf.set(parentId, siblings);
  }

  const build = (parentId: string | null): NavNode[] =>
    (childrenOf.get(parentId) ?? [])
      .toSorted(byOrder)
      .map((module) => ({ module, children: build(module.id) }));

  return build(null);
}

/** 網址正規化:去掉結尾的 `/`(根路徑除外),讓 `/system/org-manager/` 也能對上路由集合。 */
export function normalizePathname(pathname: string): string {
  let end = pathname.length;
  while (end > 0 && pathname[end - 1] === "/") {
    end -= 1;
  }
  return end === 0 ? "/" : pathname.slice(0, end);
}

/** 在側欄樹裡找 route 等於此路徑的節點(深度優先);找不到回 undefined。 */
export function findNavNode(
  nodes: readonly NavNode[],
  route: string,
): NavNode | undefined {
  for (const node of nodes) {
    if (node.module.route === route) {
      return node;
    }
    const found = findNavNode(node.children, route);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

/** 群組不是頁面:點群組時要去的地方 = 它底下(深度優先)第一個 link 的路由;沒有則 null。 */
export function firstLinkRoute(node: NavNode | undefined): string | null {
  if (node === undefined) {
    return null;
  }
  if (node.module.sidebarType === ModuleSidebarType.Link) {
    return node.module.route ?? null;
  }
  for (const child of node.children) {
    const route = firstLinkRoute(child);
    if (route !== null) {
      return route;
    }
  }
  return null;
}

/**
 * 「可進入路由集合」(ADR-0011「路由防守」):可進 = 有那個模組路由,僅此一條。
 * link 與 hidden(編輯頁等)都是頁面;群組只是側欄節點與路徑前綴,api 樹沒有路由 — 兩者都不在集合內。
 */
export function enterableRouteMap(
  modules: readonly ShellModule[],
): ReadonlyMap<string, ShellModule> {
  const routes = new Map<string, ShellModule>();
  for (const module of modules) {
    if (
      module.route !== null &&
      module.route !== undefined &&
      module.sidebarType !== ModuleSidebarType.Group
    ) {
      routes.set(module.route, module);
    }
  }
  return routes;
}
