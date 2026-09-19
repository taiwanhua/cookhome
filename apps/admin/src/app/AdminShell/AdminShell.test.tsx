import { describe, expect, it } from "@jest/globals";
import { screen, waitFor, within } from "@testing-library/react";

import { LOCALE_STORAGE_KEY } from "@/lib/locale";
import {
  SWITCHED_ACCESS_TOKEN,
  authWorld,
  overviewModule,
  testOrg,
} from "@/test/msw/auth-handlers";
import {
  sampleTwoModules,
  superAdminModules,
} from "@/test/msw/module-fixtures";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/render";

const findSideNav = async () =>
  screen.findByRole("navigation", { name: "主選單" });

describe("SideNav(模組陣列以 parentId 組樹;ADR-0011「前端判斷 / 側欄」)", () => {
  it("超級管理員:總覽 + 系統管理群組六項 + 示範群組(含次群組),依 order 排序,hidden 模組不出現", async () => {
    server.use(
      ...authWorld({ hasRefreshCookie: true, modules: superAdminModules })
        .handlers,
    );

    renderApp({ path: "/overview" });
    const nav = await findSideNav();

    const labels = within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(labels).toEqual([
      "總覽",
      "組織管理",
      "使用者管理",
      "角色管理",
      "模組與權限",
      "欄位管理",
      "資料範圍",
      "示範模組1",
      "示範模組2",
    ]);
    expect(
      within(nav).getByRole("button", { name: "系統管理" }),
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole("button", { name: "示範次群組" }),
    ).toBeInTheDocument();
    expect(within(nav).queryByText("編輯示範項目")).not.toBeInTheDocument();
    expect(within(nav).queryByText("API 能力")).not.toBeInTheDocument();
  });

  it("只綁示範模組2 的角色:只看到示範群組,沒有系統管理、也沒有總覽(總覽是模組,受權限過濾)", async () => {
    server.use(
      ...authWorld({ hasRefreshCookie: true, modules: sampleTwoModules })
        .handlers,
    );

    renderApp({ path: "/demo/sample-two" });
    const nav = await findSideNav();

    expect(within(nav).getByText("示範模組2")).toBeInTheDocument();
    expect(within(nav).queryByText("系統管理")).not.toBeInTheDocument();
    expect(within(nav).queryByText("組織管理")).not.toBeInTheDocument();
    expect(within(nav).queryByText("總覽")).not.toBeInTheDocument();
  });

  it("群組可收合再展開", async () => {
    server.use(
      ...authWorld({ hasRefreshCookie: true, modules: sampleTwoModules })
        .handlers,
    );

    const { user } = renderApp({ path: "/demo/sample-two" });
    const nav = await findSideNav();
    const group = within(nav).getByRole("button", { name: "示範群組" });
    expect(group).toHaveAttribute("aria-expanded", "true");

    await user.click(group);
    expect(group).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => {
      expect(within(nav).queryByText("示範模組2")).not.toBeInTheDocument();
    });

    await user.click(group);
    expect(await within(nav).findByText("示範模組2")).toBeInTheDocument();
  });

  it("頂部顯示當前組織名稱(商標槽位保留,本段不顯圖)", async () => {
    server.use(...authWorld({ hasRefreshCookie: true }).handlers);

    renderApp({ path: "/" });
    const nav = await findSideNav();

    expect(within(nav).getByText("CookHome")).toBeInTheDocument();
    expect(within(nav).queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("路由與導向(ADR-0011「路由與導向規則」:模組路由 / 群組路由 / `/`)", () => {
  it("`/` → 側欄第一個能進的頁:有總覽權限就是 /overview(佔位內容:問候 + 當前組織)", async () => {
    server.use(...authWorld({ hasRefreshCookie: true }).handlers);

    renderApp({ path: "/" });

    expect(await screen.findByText("小華,你好")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/overview");
    expect(screen.getByRole("banner")).toHaveTextContent("總覽");
  });

  it("`/` 而沒有總覽權限 → 依側欄順序深度優先找第一個 link(只綁示範模組2 → /demo/sample-two)", async () => {
    server.use(
      ...authWorld({ hasRefreshCookie: true, modules: sampleTwoModules })
        .handlers,
    );

    renderApp({ path: "/" });

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/demo/sample-two",
      );
    });
    expect(
      await screen.findByRole("heading", { name: "示範模組2" }),
    ).toBeInTheDocument();
  });

  it("`/` 而側欄一個能進的頁都沒有 → 無權限頁(沒有「回首頁」按鈕)", async () => {
    server.use(...authWorld({ hasRefreshCookie: true, modules: [] }).handlers);

    renderApp({ path: "/" });

    expect(
      await screen.findByRole("heading", { name: "沒有權限進入此頁面" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "回首頁" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
  });

  it("群組路由 /system → 該群組底下第一個 link(/system/org-manager);同一條規則", async () => {
    server.use(
      ...authWorld({ hasRefreshCookie: true, modules: superAdminModules })
        .handlers,
    );

    renderApp({ path: "/system" });

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/system/org-manager",
      );
    });
  });

  it("手打 /system/org-manager 而模組陣列無此模組 → 無權限頁(有「回首頁」)", async () => {
    server.use(
      ...authWorld({ hasRefreshCookie: true, modules: sampleTwoModules })
        .handlers,
    );

    renderApp({ path: "/system/org-manager" });

    expect(
      await screen.findByRole("heading", { name: "沒有權限進入此頁面" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "回首頁" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/system/org-manager",
    );
  });

  it("有此模組 → 佔位頁顯示模組名,AppBar 標題同步", async () => {
    server.use(
      ...authWorld({ hasRefreshCookie: true, modules: superAdminModules })
        .handlers,
    );

    // 用還沒實作的模組驗佔位頁(組織管理 / 使用者管理已有真頁面,沒有這個標題)
    renderApp({ path: "/system/role-manager" });

    const heading = await screen.findByRole("heading", { name: "角色管理" });
    expect(screen.getByRole("main")).toContainElement(heading);
    expect(screen.getByRole("banner")).toHaveTextContent("角色管理");
  });

  it("隱藏頁(編輯頁)有路由可進;點側欄連結切換內容區", async () => {
    server.use(
      ...authWorld({ hasRefreshCookie: true, modules: sampleTwoModules })
        .handlers,
    );

    const { user } = renderApp({ path: "/demo/sample-two/edit-page" });
    expect(
      await screen.findByRole("heading", { name: "編輯" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "示範模組2" }));

    const heading = await screen.findByRole("heading", { name: "示範模組2" });
    expect(screen.getByRole("main")).toContainElement(heading);
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/demo/sample-two",
    );
  });

  it("mustChangePassword=true → 導向 /change-password,不進殼", async () => {
    server.use(
      ...authWorld({
        hasRefreshCookie: true,
        modules: superAdminModules,
        mustChangePassword: true,
      }).handlers,
    );

    renderApp({ path: "/system/org-manager" });

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/change-password",
      );
    });
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});

describe("AppBar(當前組織切換、使用者選單、語言)", () => {
  const tenant = { id: "org-2", name: "測試租戶" };

  it("組織切換器列出所屬組織;切換後換票、me 重取、當前組織更新", async () => {
    const world = authWorld({
      hasRefreshCookie: true,
      modules: [overviewModule, ...sampleTwoModules],
      orgs: [testOrg, tenant],
    });
    server.use(...world.handlers);
    let lastBearer: string | null = null;
    server.events.on("request:start", ({ request }) => {
      lastBearer = request.headers.get("authorization");
    });

    const { user } = renderApp({ path: "/overview" });
    const switcher = await screen.findByRole("combobox", { name: "當前組織" });
    expect(switcher).toHaveTextContent("CookHome");
    const meCallsBefore = world.calls.me;

    await user.click(switcher);
    await user.click(await screen.findByRole("option", { name: "測試租戶" }));

    await waitFor(() => {
      expect(switcher).toHaveTextContent("測試租戶");
    });
    expect(world.calls.switchOrg).toBe(1);
    expect(world.calls.me).toBe(meCallsBefore + 1);
    expect(lastBearer).toBe(`Bearer ${SWITCHED_ACCESS_TOKEN}`);
    expect(
      within(await findSideNav()).getByText("測試租戶"),
    ).toBeInTheDocument();
    expect(screen.getByText("當前組織:測試租戶")).toBeInTheDocument();
  });

  it("使用者選單:登出所有裝置 → 打 api、回登入頁", async () => {
    const world = authWorld({
      hasRefreshCookie: true,
      modules: sampleTwoModules,
    });
    server.use(...world.handlers);

    const { user } = renderApp({ path: "/demo/sample-two" });
    await user.click(await screen.findByRole("button", { name: "小華" }));
    await user.click(screen.getByRole("menuitem", { name: "登出所有裝置" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/login");
    });
    expect(world.calls.logoutAllDevices).toBe(1);
  });

  it("語言切換器:切到 English 後文案變英文並記在 localStorage", async () => {
    server.use(...authWorld({ hasRefreshCookie: true }).handlers);

    const { user } = renderApp({ path: "/overview" });
    const language = await screen.findByRole("combobox", { name: "語言" });

    await user.click(language);
    await user.click(await screen.findByRole("option", { name: "English" }));

    expect(
      await screen.findByRole("navigation", { name: "Main navigation" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en");
    localStorage.removeItem(LOCALE_STORAGE_KEY);
  });
});
