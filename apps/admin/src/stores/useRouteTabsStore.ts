import { create } from "zustand";
import { type PersistStorage, persist } from "zustand/middleware";

import {
  ROUTE_TABS_STORAGE_PREFIX,
  type RouteTabEntry,
  closeEntry,
  isSameEntries,
  moveEntry,
  readStoredEntries,
  routeTabsStorageKey,
  syncEntries,
  writeStoredEntries,
} from "../lib/route-tabs";

interface RouteTabsPersisted {
  entries: RouteTabEntry[];
}

export interface RouteTabsStoreState extends RouteTabsPersisted {
  /** 綁定登入者:切到 `cookhome-admin-route-tabs:<userId>` 這把 key 並從 sessionStorage 讀回(殼 mount 時呼叫) */
  bind: (userId: string) => void;
  /** 與「可進入路由集合」對齊 + 目前路徑生成 tab(進入路由即呼叫;沒變化不寫回、不通知) */
  sync: (routes: ReadonlyMap<string, unknown>, currentPath: string) => void;
  /** 關閉 tab;回傳關閉當前 tab 時要轉去的路由(非當前為 null) */
  close: (route: string, activeRoute: string | null) => string | null;
  move: (fromRoute: string, toRoute: string) => void;
}

/**
 * sessionStorage 存的是紀錄陣列本身(`[{ route }]`),不是 zustand 的 JSON 封包 — 沿用重構前的格式與 key(docs/branding.md)。
 * `getItem` 讀不到回空陣列(不是 null),讓 `bind` 換使用者時一定以 storage 內容覆蓋記憶體、不會撿到上一個人的頁籤。
 */
const storage: PersistStorage<RouteTabsPersisted> = {
  getItem: (name) => ({ state: { entries: readStoredEntries(name) } }),
  setItem: (name, value) => {
    writeStoredEntries(name, value.state.entries);
  },
  removeItem: (name) => {
    try {
      sessionStorage.removeItem(name);
    } catch {
      // sessionStorage 不可用時本來就沒存,不需處理
    }
  },
};

/**
 * 路由頁籤列的狀態(#67;REACT-02 zustand + persist):進入模組路由即生成 tab、以路由去重;關閉當前 tab 切到相鄰;順序可調;
 * 保留在 sessionStorage(同一分頁重新整理後還在,關掉分頁即清),每個使用者一把 key。
 * 純函式(`syncEntries` / `closeEntry` / `moveEntry`)在 `lib/route-tabs.ts`;這裡只負責狀態、寫回與通知。
 */
export const useRouteTabsStore = create<RouteTabsStoreState>()(
  persist(
    (set, get, api) => {
      const commit = (next: RouteTabEntry[]) => {
        if (!isSameEntries(next, get().entries)) {
          set({ entries: next });
        }
      };

      return {
        entries: [],
        bind: (userId) => {
          api.persist.setOptions({ name: routeTabsStorageKey(userId) });
          void api.persist.rehydrate();
        },
        sync: (routes, currentPath) => {
          commit(syncEntries(get().entries, routes, currentPath));
        },
        close: (route, activeRoute) => {
          const result = closeEntry(get().entries, route, activeRoute);
          commit(result.entries);
          return result.navigateTo;
        },
        move: (fromRoute, toRoute) => {
          commit(moveEntry(get().entries, fromRoute, toRoute));
        },
      };
    },
    {
      // 真正的 key 在 bind 時才知道(帶 userId);建立時不讀 storage
      name: ROUTE_TABS_STORAGE_PREFIX,
      storage,
      partialize: (state) => ({ entries: state.entries }),
      skipHydration: true,
    },
  ),
);
