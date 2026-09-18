import { beforeEach, describe, expect, it } from "@jest/globals";

import { overviewModule } from "../../test/msw/auth-handlers";
import { systemModules } from "../../test/msw/module-fixtures";
import { enterableRouteMap } from "./module-tree";
import {
  EMPTY_TABS_ROUTE,
  type RouteTabEntry,
  closeEntry,
  createRouteTabsStore,
  moveEntry,
  readStoredEntries,
  resolveTabs,
  routeTabsStorageKey,
  syncEntries,
} from "./route-tabs-store";

const routes = enterableRouteMap([overviewModule, ...systemModules]);
const OVERVIEW = "/overview";
const ORG = "/system/org-manager";
const USER = "/system/user-manager";
const entriesOf = (...list: string[]): RouteTabEntry[] =>
  list.map((route) => ({ route }));
const routesOf = (entries: readonly RouteTabEntry[]) =>
  entries.map((entry) => entry.route);

describe("syncEntries(進入路由即生成、去重、剔除進不去的)", () => {
  it("目前路徑是模組路由且沒有 tab → 追加到最後", () => {
    expect(routesOf(syncEntries(entriesOf(OVERVIEW), routes, ORG))).toEqual([
      OVERVIEW,
      ORG,
    ]);
  });

  it("已有 tab 的路由不重複生成;順序不變", () => {
    expect(
      routesOf(syncEntries(entriesOf(ORG, OVERVIEW), routes, OVERVIEW)),
    ).toEqual([ORG, OVERVIEW]);
  });

  it("`/`、群組路由、不在集合內的路徑都不生成 tab", () => {
    expect(routesOf(syncEntries([], routes, "/"))).toEqual([]);
    expect(routesOf(syncEntries([], routes, "/system"))).toEqual([]);
    expect(routesOf(syncEntries([], routes, "/nope"))).toEqual([]);
  });

  it("進不去的路由(權限變了)被剔除", () => {
    expect(
      routesOf(
        syncEntries(entriesOf(OVERVIEW, "/demo/sample-two", ORG), routes, ORG),
      ),
    ).toEqual([OVERVIEW, ORG]);
  });
});

describe("closeEntry(關閉當前 tab 切到相鄰)", () => {
  it("關閉非當前 tab:只移除,不轉向", () => {
    const result = closeEntry(entriesOf(OVERVIEW, ORG, USER), OVERVIEW, ORG);
    expect(routesOf(result.entries)).toEqual([ORG, USER]);
    expect(result.navigateTo).toBeNull();
  });

  it("關閉當前(中間)tab:切到右邊那個", () => {
    const result = closeEntry(entriesOf(OVERVIEW, ORG, USER), ORG, ORG);
    expect(routesOf(result.entries)).toEqual([OVERVIEW, USER]);
    expect(result.navigateTo).toBe(USER);
  });

  it("關閉當前(最右)tab:切到左邊那個", () => {
    const result = closeEntry(entriesOf(OVERVIEW, ORG, USER), USER, USER);
    expect(result.navigateTo).toBe(ORG);
  });

  it("關到一個都不剩:回首頁(由既有規則轉到側欄第一個能進的頁)", () => {
    const result = closeEntry(entriesOf(ORG), ORG, ORG);
    expect(result.entries).toEqual([]);
    expect(result.navigateTo).toBe(EMPTY_TABS_ROUTE);
  });

  it("關閉不存在的 tab:不動", () => {
    const result = closeEntry(entriesOf(ORG), USER, ORG);
    expect(routesOf(result.entries)).toEqual([ORG]);
    expect(result.navigateTo).toBeNull();
  });
});

describe("moveEntry(排序)", () => {
  it("往右移到目標位置", () => {
    expect(
      routesOf(moveEntry(entriesOf(OVERVIEW, ORG, USER), OVERVIEW, USER)),
    ).toEqual([ORG, USER, OVERVIEW]);
  });

  it("往左移到目標位置", () => {
    expect(
      routesOf(moveEntry(entriesOf(OVERVIEW, ORG, USER), USER, OVERVIEW)),
    ).toEqual([USER, OVERVIEW, ORG]);
  });

  it("任一路由不存在或相同:不動", () => {
    expect(
      routesOf(moveEntry(entriesOf(OVERVIEW, ORG), OVERVIEW, "/nope")),
    ).toEqual([OVERVIEW, ORG]);
    expect(routesOf(moveEntry(entriesOf(OVERVIEW, ORG), ORG, ORG))).toEqual([
      OVERVIEW,
      ORG,
    ]);
  });
});

describe("resolveTabs(名稱從模組陣列取;子 tab 擴充點)", () => {
  it("一般 tab 顯示模組名;itemLabel 有值時顯示「模組 / 項目名」", () => {
    const tabs = resolveTabs(
      [{ route: OVERVIEW }, { route: ORG, itemLabel: "台北店" }],
      routes,
    );
    expect(tabs.map((tab) => [tab.label, tab.moduleKey])).toEqual([
      ["總覽", "overview"],
      ["組織管理 / 台北店", "system.org-manager"],
    ]);
  });
});

describe("sessionStorage 保留", () => {
  const key = routeTabsStorageKey("user-1");

  beforeEach(() => {
    sessionStorage.clear();
  });

  it("store 的每次變更都寫回;新的 store 從同一把 key 讀回", () => {
    const store = createRouteTabsStore(key);
    store.sync(routes, OVERVIEW);
    store.sync(routes, ORG);
    store.move(OVERVIEW, ORG);

    expect(routesOf(createRouteTabsStore(key).getEntries())).toEqual([
      ORG,
      OVERVIEW,
    ]);
    expect(routesOf(readStoredEntries(key))).toEqual([ORG, OVERVIEW]);
  });

  it("壞掉或形狀不對的內容當作空,不丟例外", () => {
    sessionStorage.setItem(key, "{not json");
    expect(readStoredEntries(key)).toEqual([]);
    sessionStorage.setItem(key, JSON.stringify([{ route: 1 }, { route: ORG }]));
    expect(routesOf(readStoredEntries(key))).toEqual([ORG]);
  });

  it("沒變化不通知訂閱者(快照參考不變)", () => {
    const store = createRouteTabsStore(key);
    store.sync(routes, ORG);
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });
    const before = store.getEntries();
    store.sync(routes, ORG);
    expect(store.getEntries()).toBe(before);
    expect(notified).toBe(0);
  });
});
