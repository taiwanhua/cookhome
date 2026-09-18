import { useMemo } from "react";
import { Navigate, useLocation } from "react-router";

import { ForbiddenPage } from "./forbidden-page";
import { ModulePage } from "./module-page";
import {
  buildNavTree,
  enterableRouteMap,
  findNavNode,
  firstLinkRoute,
  normalizePathname,
} from "./module-tree";
import { useShellOutlet } from "./shell-context";

/**
 * 模組路由(ADR-0011「路由防守」):網址在「可進入路由集合」內 → 該模組的佔位頁;
 * 是群組路由 → 轉到它底下第一個 link;都不是 → 無權限頁(明確提示是權限問題,不是壞掉)。
 */
export function ModuleRoute() {
  const { me } = useShellOutlet();
  const { pathname } = useLocation();
  const { modules } = me;

  const routes = useMemo(() => enterableRouteMap(modules), [modules]);
  const tree = useMemo(() => buildNavTree(modules), [modules]);

  const path = normalizePathname(pathname);
  const module = routes.get(path);
  if (module !== undefined) {
    return <ModulePage module={module} />;
  }

  const groupTarget = firstLinkRoute(findNavNode(tree, path));
  if (groupTarget !== null) {
    return <Navigate to={groupTarget} replace />;
  }

  return <ForbiddenPage />;
}
