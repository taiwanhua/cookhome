import { type ShellModule, matchModuleRoute } from "./module-tree";

/**
 * 一筆路由頁籤的紀錄(#67;dis #15:以路由 id 去重)。持久化到 sessionStorage 的就是這個形狀(`[{ route, itemLabel? }]`),
 * 模組名一律回頭從 `me.modules` 解析,權限或名稱變了不會留下舊字;唯一存下來的顯示資料是頁面給的 `itemLabel`。
 */
export interface RouteTabEntry {
  /**
   * 頁籤的唯一 id = 網址(已正規化)。一般頁籤是模組路由本身(= `me.modules[].route`);
   * 詳情子頁籤(#428)是隱藏頁模組路由 + 尾端識別碼(`/…/view-page/<id>`,`matchModuleRoute` 對得上的那種),每一筆各一個 tab。
   */
  route: string;
  /**
   * 詳情子頁籤的項目名(#428):由頁面經 `useRouteTabItemLabel` → store 的 `setItemLabel` 提供,
   * `resolveTabs` 顯示成「所屬模組名 — 項目名」。頁面每次進入都會重設,所以存檔裡的舊名只活到下次進入那一頁。
   */
  itemLabel?: string;
}

/** 解析後可渲染的頁籤:紀錄 + 從模組陣列查到的名稱。 */
export interface RouteTab extends RouteTabEntry {
  label: string;
  moduleKey: string;
}

/** 詳情子頁籤「所屬模組名」與「項目名」之間的分隔(#428)。 */
export const ITEM_LABEL_SEPARATOR = " — ";

/** 關閉時「切到相鄰」的落點;沒有 tab 可切時回首頁(`/` 由 ADR-0011 規則轉到側欄第一個能進的頁)。 */
export const EMPTY_TABS_ROUTE = "/";

/** sessionStorage key 前綴(帶品牌 slug,登記於 docs/branding.md);每個使用者一把,換帳號登入不會撿到別人的頁籤。 */
export const ROUTE_TABS_STORAGE_PREFIX = "cookhome-admin-route-tabs";

export const routeTabsStorageKey = (userId: string): string =>
  `${ROUTE_TABS_STORAGE_PREFIX}:${userId}`;

const isRouteTabEntry = (value: unknown): value is RouteTabEntry => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { route, itemLabel } = value as Record<string, unknown>;
  return (
    typeof route === "string" &&
    (itemLabel === undefined || typeof itemLabel === "string")
  );
};

/** 讀回上次的頁籤;讀不到、格式不對(舊版或被改過)一律當空,不阻擋殼渲染。 */
export const readStoredEntries = (storageKey: string): RouteTabEntry[] => {
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
};

export const writeStoredEntries = (
  storageKey: string,
  entries: readonly RouteTabEntry[],
): void => {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(entries));
  } catch {
    // sessionStorage 不可用時只影響「重新整理後保留」,頁籤列本身照常運作
  }
};

/** 兩份紀錄逐筆同參考 → 視為沒變化(store 據此略過通知與寫回)。 */
export const isSameEntries = (
  a: readonly RouteTabEntry[],
  b: readonly RouteTabEntry[],
): boolean =>
  a.length === b.length && a.every((entry, index) => entry === b[index]);

/**
 * 網址進得去嗎(ADR-0011「路由防守」的同一個比對,含隱藏頁的尾端識別碼退路):
 * 頁籤的生成、保留、選中都用這一條,與 `ModuleRoute` 放不放行永遠一致。
 */
const isEnterable = (
  routes: ReadonlyMap<string, ShellModule>,
  path: string,
): boolean => matchModuleRoute(routes, path) !== undefined;

/**
 * 與「可進入路由集合」對齊:進不去的路由(權限變了、換了組織)剔除;目前路徑能進而還沒有 tab → 追加到最後
 * (= 進入路由即生成 tab;重複進入不重複生成)。`/`、群組路由、無權限頁都不在集合內,不生成。
 * 詳情 / 編輯頁的 `/…/view-page/<id>` 也算能進(#428):每一筆各生成一個子頁籤。沒變化就回原陣列。
 */
export const syncEntries = (
  entries: readonly RouteTabEntry[],
  routes: ReadonlyMap<string, ShellModule>,
  currentPath: string,
): RouteTabEntry[] => {
  const kept = entries.filter((entry) => isEnterable(routes, entry.route));
  const hasCurrent = kept.some((entry) => entry.route === currentPath);
  if (!hasCurrent && isEnterable(routes, currentPath)) {
    kept.push({ route: currentPath });
  }
  return isSameEntries(kept, entries) ? [...entries] : kept;
};

/**
 * 設定詳情子頁籤的項目名(#428):有那個 tab → 換掉標籤(同名不動、回原陣列);還沒有 → 帶著標籤追加到最後。
 * 追加是為了時序:子元件(頁面)的 effect 比殼的 `sync` 早跑,項目資料已在快取時頁面會先呼叫這裡;
 * 路由進不進得去仍由緊接著的 `sync` 把關(進不去的會被剔除)。空字串視同沒有標籤,不動。
 */
export const setEntryItemLabel = (
  entries: readonly RouteTabEntry[],
  route: string,
  itemLabel: string,
): RouteTabEntry[] => {
  if (itemLabel === "") {
    return [...entries];
  }
  const index = entries.findIndex((entry) => entry.route === route);
  if (index === -1) {
    return [...entries, { route, itemLabel }];
  }
  if (entries[index].itemLabel === itemLabel) {
    return [...entries];
  }
  return entries.map((entry, at) =>
    at === index ? { ...entry, itemLabel } : entry,
  );
};

export interface CloseResult {
  entries: RouteTabEntry[];
  /** 關閉的是當前 tab 時要轉去的路由(相鄰 tab:右邊優先,沒有就左邊;都沒有回 `EMPTY_TABS_ROUTE`);非當前 tab 為 null */
  navigateTo: string | null;
}

export const closeEntry = (
  entries: readonly RouteTabEntry[],
  route: string,
  activeRoute: string | null,
): CloseResult => {
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
};

/** 把 `fromRoute` 的 tab 移到 `toRoute` 目前的位置(拖曳 / Shift+方向鍵共用);任一不存在則不動。 */
export const moveEntry = (
  entries: readonly RouteTabEntry[],
  fromRoute: string,
  toRoute: string,
): RouteTabEntry[] => {
  const from = entries.findIndex((entry) => entry.route === fromRoute);
  const to = entries.findIndex((entry) => entry.route === toRoute);
  if (from === -1 || to === -1 || from === to) {
    return [...entries];
  }
  const next = [...entries];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

/**
 * 詳情子頁籤前半段的「所屬模組」:隱藏頁模組(詳情、編輯)的父模組在可進入集合內時用父模組
 * (「示範模組1 — 項目名」,而不是「示範項目詳情 — 項目名」);否則用自己。
 */
const ownerModuleOf = (
  module: ShellModule,
  routes: ReadonlyMap<string, ShellModule>,
): ShellModule => {
  if (module.parentId === null || module.parentId === undefined) {
    return module;
  }
  for (const candidate of routes.values()) {
    if (candidate.id === module.parentId) {
      return candidate;
    }
  }
  return module;
};

/**
 * 紀錄 → 可渲染的頁籤:名稱從模組陣列取;對不上模組的紀錄略過(`syncEntries` 已剔除,這裡只是保底)。
 * 有 `itemLabel` → 「所屬模組名 — 項目名」;沒有(一般頁籤、詳情頁資料還沒到)→ 網址對上的那個模組自己的名稱。
 */
export const resolveTabs = (
  entries: readonly RouteTabEntry[],
  routes: ReadonlyMap<string, ShellModule>,
): RouteTab[] => {
  const tabs: RouteTab[] = [];
  for (const entry of entries) {
    const module = matchModuleRoute(routes, entry.route)?.module;
    if (module === undefined) {
      continue;
    }
    tabs.push({
      ...entry,
      moduleKey: module.key,
      label:
        entry.itemLabel === undefined
          ? module.name
          : `${ownerModuleOf(module, routes).name}${ITEM_LABEL_SEPARATOR}${entry.itemLabel}`,
    });
  }
  return tabs;
};
