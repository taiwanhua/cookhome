import type { ShellModule } from "./module-tree";

/**
 * 一筆路由頁籤的紀錄(#67;dis #15:以路由 id 去重)。持久化到 sessionStorage 的就是這個形狀,
 * 所以只存「識別」不存顯示資料 — 名稱一律回頭從 `me.modules` 解析,權限或名稱變了不會留下舊字。
 */
export interface RouteTabEntry {
  /** 模組路由(完整路徑,= `me.modules[].route`);tab 的唯一 id */
  route: string;
  /**
   * 擴充點(dis #15「鑽入詳情生成『模組 / 項目名』子 tab」):鑽入詳情時填入項目名,`resolveTabs` 會顯示成「模組 / 項目名」;
   * 屆時 `route` 改用含識別碼的路徑去重。本段沒有詳情頁,不生成、不讀取。
   */
  itemLabel?: string;
}

/** 解析後可渲染的頁籤:紀錄 + 從模組陣列查到的名稱。 */
export interface RouteTab extends RouteTabEntry {
  label: string;
  moduleKey: string;
}

/** 關閉時「切到相鄰」的落點;沒有 tab 可切時回首頁(`/` 由 ADR-0011 規則轉到側欄第一個能進的頁)。 */
export const EMPTY_TABS_ROUTE = "/";

/** sessionStorage key 前綴(帶品牌 slug,登記於 docs/branding.md);每個使用者一把,換帳號登入不會撿到別人的頁籤。 */
export const ROUTE_TABS_STORAGE_PREFIX = "cookhome-admin-route-tabs";

export function routeTabsStorageKey(userId: string): string {
  return `${ROUTE_TABS_STORAGE_PREFIX}:${userId}`;
}

function isRouteTabEntry(value: unknown): value is RouteTabEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { route, itemLabel } = value as Record<string, unknown>;
  return (
    typeof route === "string" &&
    (itemLabel === undefined || typeof itemLabel === "string")
  );
}

/** 讀回上次的頁籤;讀不到、格式不對(舊版或被改過)一律當空,不阻擋殼渲染。 */
export function readStoredEntries(storageKey: string): RouteTabEntry[] {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (raw === null) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRouteTabEntry) : [];
  } catch {
    return [];
  }
}

export function writeStoredEntries(
  storageKey: string,
  entries: readonly RouteTabEntry[],
): void {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(entries));
  } catch {
    // sessionStorage 不可用時只影響「重新整理後保留」,頁籤列本身照常運作
  }
}

/**
 * 與「可進入路由集合」對齊:進不去的路由(權限變了、換了組織)剔除;目前路徑能進而還沒有 tab → 追加到最後
 * (= 進入路由即生成 tab;重複進入不重複生成)。`/`、群組路由、無權限頁都不在集合內,不生成。沒變化就回原陣列。
 */
export function syncEntries(
  entries: readonly RouteTabEntry[],
  routes: ReadonlyMap<string, unknown>,
  currentPath: string,
): RouteTabEntry[] {
  const kept = entries.filter((entry) => routes.has(entry.route));
  const hasCurrent = kept.some((entry) => entry.route === currentPath);
  if (!hasCurrent && routes.has(currentPath)) {
    kept.push({ route: currentPath });
  }
  const isUnchanged =
    kept.length === entries.length &&
    kept.every((entry, index) => entry === entries[index]);
  return isUnchanged ? [...entries] : kept;
}

export interface CloseResult {
  entries: RouteTabEntry[];
  /** 關閉的是當前 tab 時要轉去的路由(相鄰 tab:右邊優先,沒有就左邊;都沒有回 `EMPTY_TABS_ROUTE`);非當前 tab 為 null */
  navigateTo: string | null;
}

export function closeEntry(
  entries: readonly RouteTabEntry[],
  route: string,
  activeRoute: string | null,
): CloseResult {
  const index = entries.findIndex((entry) => entry.route === route);
  if (index === -1) {
    return { entries: [...entries], navigateTo: null };
  }
  const remaining = entries.filter((entry) => entry.route !== route);
  if (route !== activeRoute) {
    return { entries: remaining, navigateTo: null };
  }
  // 右邊優先(原位置現在是右邊那個),沒有就左邊;都沒有(關到空)→ 回首頁
  const neighbor =
    index < remaining.length ? remaining[index] : remaining.at(index - 1);
  return {
    entries: remaining,
    navigateTo: neighbor?.route ?? EMPTY_TABS_ROUTE,
  };
}

/** 把 `fromRoute` 的 tab 移到 `toRoute` 目前的位置(拖曳 / Shift+方向鍵共用);任一不存在則不動。 */
export function moveEntry(
  entries: readonly RouteTabEntry[],
  fromRoute: string,
  toRoute: string,
): RouteTabEntry[] {
  const from = entries.findIndex((entry) => entry.route === fromRoute);
  const to = entries.findIndex((entry) => entry.route === toRoute);
  if (from === -1 || to === -1 || from === to) {
    return [...entries];
  }
  const next = [...entries];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** 紀錄 → 可渲染的頁籤:名稱從模組陣列取;模組不在陣列內的紀錄略過(`syncEntries` 已剔除,這裡只是保底)。 */
export function resolveTabs(
  entries: readonly RouteTabEntry[],
  routes: ReadonlyMap<string, ShellModule>,
): RouteTab[] {
  const tabs: RouteTab[] = [];
  for (const entry of entries) {
    const module = routes.get(entry.route);
    if (module === undefined) {
      continue;
    }
    tabs.push({
      ...entry,
      moduleKey: module.key,
      label:
        entry.itemLabel === undefined
          ? module.name
          : `${module.name} / ${entry.itemLabel}`,
    });
  }
  return tabs;
}

/**
 * 頁籤列的狀態容器(給 `useSyncExternalStore`;不是全域 store,由殼在 mount 時建立、一個使用者一份,REACT-02):
 * 所有變更都經這裡寫回 sessionStorage,快照為不可變陣列(只在有變化時換參考)。
 */
export interface RouteTabsStore {
  subscribe: (listener: () => void) => () => void;
  getEntries: () => readonly RouteTabEntry[];
  sync: (routes: ReadonlyMap<string, unknown>, currentPath: string) => void;
  close: (route: string, activeRoute: string | null) => string | null;
  move: (fromRoute: string, toRoute: string) => void;
}

export function createRouteTabsStore(storageKey: string): RouteTabsStore {
  let entries: readonly RouteTabEntry[] = readStoredEntries(storageKey);
  const listeners = new Set<() => void>();

  const commit = (next: readonly RouteTabEntry[]) => {
    const isUnchanged =
      next.length === entries.length &&
      next.every((entry, index) => entry === entries[index]);
    if (isUnchanged) {
      return;
    }
    entries = next;
    writeStoredEntries(storageKey, entries);
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getEntries: () => entries,
    sync: (routes, currentPath) => {
      commit(syncEntries(entries, routes, currentPath));
    },
    close: (route, activeRoute) => {
      const result = closeEntry(entries, route, activeRoute);
      commit(result.entries);
      return result.navigateTo;
    },
    move: (fromRoute, toRoute) => {
      commit(moveEntry(entries, fromRoute, toRoute));
    },
  };
}
