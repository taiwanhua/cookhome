import { type ComponentType, useMemo } from "react";
import { Navigate, useLocation } from "react-router";

import { useMe } from "../auth/use-me";
import { ForbiddenPage } from "./forbidden-page";
import { ModulePage, type ModulePageProps } from "./module-page";
import {
  buildNavTree,
  enterableRouteMap,
  findNavNode,
  firstLinkRoute,
  normalizePathname,
} from "./module-tree";

/** 模組 key → 頁面元件;沒登記的模組用佔位頁 `ModulePage`(組裝在 app/module-pages.tsx)。 */
export type ModulePageRegistry = Readonly<
  Record<string, ComponentType<ModulePageProps>>
>;

interface ModuleRouteProps {
  pages: ModulePageRegistry;
}

/**
 * 模組路由(ADR-0011「路由與導向規則」):
 * - 網址在「可進入路由集合」內 → 該模組的頁面(登記過的元件,否則佔位頁)
 * - `/` 或群組路由 → 轉到側欄(該群組)第一個能進的 link;一個都沒有 → 無權限頁
 * - 其餘 → 無權限頁(明確提示是權限問題,不是壞掉)
 */
export function ModuleRoute({ pages }: Readonly<ModuleRouteProps>) {
  const me = useMe();
  const { pathname } = useLocation();
  const modules = me.data?.me.modules;

  const routes = useMemo(() => enterableRouteMap(modules ?? []), [modules]);
  const tree = useMemo(() => buildNavTree(modules ?? []), [modules]);

  if (modules === undefined) {
    // RequireAuth 已等 `me` 載入;走到這裡代表載入失敗,殼已顯示錯誤
    return null;
  }

  const path = normalizePathname(pathname);
  const module = routes.get(path);
  if (module !== undefined) {
    const Page = pages[module.key] ?? ModulePage;
    return <Page module={module} />;
  }

  const scope = path === "/" ? tree : findNavNode(tree, path)?.children;
  const target = scope === undefined ? null : firstLinkRoute(scope);
  if (target !== null) {
    return <Navigate to={target} replace />;
  }

  return <ForbiddenPage isEntry={path === "/"} />;
}
