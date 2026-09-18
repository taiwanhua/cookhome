import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useNavigate } from "react-router";

import type { ShellModule } from "./module-tree";
import {
  type RouteTab,
  createRouteTabsStore,
  resolveTabs,
  routeTabsStorageKey,
} from "./route-tabs-store";

export interface UseRouteTabsOptions {
  /** 登入者 id:sessionStorage 以它分 key */
  userId: string;
  /** 可進入路由集合(`enterableRouteMap`) */
  routes: ReadonlyMap<string, ShellModule>;
  /** 目前網址(已正規化) */
  currentPath: string;
}

export interface RouteTabsState {
  tabs: RouteTab[];
  /** 目前網址對應的 tab 路由;網址不是模組路由(`/`、群組、無權限頁)時為 null,沒有 tab 是選中的 */
  activeRoute: string | null;
  select: (route: string) => void;
  close: (route: string) => void;
  move: (fromRoute: string, toRoute: string) => void;
}

/**
 * 路由頁籤列的狀態(#67):進入模組路由即生成 tab、以路由去重;關閉當前 tab 切到相鄰;順序可調;
 * 保留在 sessionStorage(同一分頁重新整理後還在,關掉分頁即清)。
 * 狀態容器在殼 mount 時建立(一個使用者一份 key);登出會卸載殼,換帳號登入自然拿到新的一份。
 */
export function useRouteTabs({
  userId,
  routes,
  currentPath,
}: UseRouteTabsOptions): RouteTabsState {
  const navigate = useNavigate();
  const [store] = useState(() => {
    const created = createRouteTabsStore(routeTabsStorageKey(userId));
    // 首次渲染就對齊(目前頁的 tab 立刻出現,不等 effect 多閃一幀)
    created.sync(routes, currentPath);
    return created;
  });
  const entries = useSyncExternalStore(store.subscribe, store.getEntries);

  useEffect(() => {
    store.sync(routes, currentPath);
  }, [store, routes, currentPath]);

  const tabs = useMemo(() => resolveTabs(entries, routes), [entries, routes]);
  const activeRoute = routes.has(currentPath) ? currentPath : null;

  const select = useCallback(
    (route: string) => {
      void navigate(route);
    },
    [navigate],
  );

  const close = useCallback(
    (route: string) => {
      const target = store.close(route, activeRoute);
      if (target !== null) {
        void navigate(target);
      }
    },
    [store, activeRoute, navigate],
  );

  const move = useCallback(
    (fromRoute: string, toRoute: string) => {
      store.move(fromRoute, toRoute);
    },
    [store],
  );

  return { tabs, activeRoute, select, close, move };
}
