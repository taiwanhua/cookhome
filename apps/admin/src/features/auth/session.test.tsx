import { describe, expect, it } from "@jest/globals";
import { screen, waitFor } from "@testing-library/react";

import { useMeQuery } from "@repo/graphql";

import { createAuthSession } from "../../lib/auth/session";
import { SESSION_CHANNEL_NAME } from "../../lib/auth/session-channel";
import { authWorld } from "../../test/msw/auth-handlers";
import { TEST_GRAPHQL_ENDPOINT, server } from "../../test/msw/server";
import { renderApp } from "../../test/render";

describe("登入狀態(access token 記憶體 / 靜默 refresh / 導回 login?next)", () => {
  it("重新整理後(記憶體無 token)以 refresh cookie 自動恢復登入狀態", async () => {
    const world = authWorld({ hasRefreshCookie: true });
    server.use(...world.handlers);

    renderApp({ path: "/" });

    expect(await screen.findByText("小華,你好")).toBeInTheDocument();
    expect(world.calls.refresh).toBe(1);
    expect(world.calls.login).toBe(0);
  });

  it("refresh 失敗 → 導 /login?next=原路徑;登入後回到原路徑", async () => {
    const world = authWorld({ hasRefreshCookie: false });
    server.use(...world.handlers);

    const { user } = renderApp({ path: "/?tab=recipes" });

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/login?next=%2F%3Ftab%3Drecipes",
      );
    });

    await user.type(screen.getByLabelText("帳號"), "root");
    await user.type(screen.getByLabelText("密碼"), "secret-1234");
    await user.click(screen.getByRole("button", { name: "登入" }));

    expect(await screen.findByText("小華,你好")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/?tab=recipes");
  });

  it("受保護請求 TOKEN_EXPIRED → 靜默 refresh → 原請求重送成功", async () => {
    const world = authWorld({
      hasRefreshCookie: true,
      refreshedTokens: ["access-2", "access-3"],
      expiredTokens: ["access-2"],
    });
    server.use(...world.handlers);

    renderApp({ path: "/" });

    expect(await screen.findByText("小華,你好")).toBeInTheDocument();
    // 開機換票 1 次 + 逾期後換票 1 次;me 打 2 次(原請求 + 重送)
    expect(world.calls.refresh).toBe(2);
    expect(world.calls.me).toBe(2);
  });

  it("重送後仍 TOKEN_EXPIRED 只重試一次,不無限循環", async () => {
    const world = authWorld({
      hasRefreshCookie: true,
      refreshedTokens: ["access-2", "access-3"],
      expiredTokens: ["access-2", "access-3"],
    });
    server.use(...world.handlers);

    renderApp({ path: "/" });

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(world.calls.me).toBe(2);
    expect(world.calls.refresh).toBe(2);
  });

  it("多個請求同時遇到 TOKEN_EXPIRED,refresh 只打一次(單飛)", async () => {
    const world = authWorld({
      hasRefreshCookie: true,
      refreshedTokens: ["access-2", "access-3"],
      expiredTokens: ["access-2"],
    });
    server.use(...world.handlers);
    const session = createAuthSession(TEST_GRAPHQL_ENDPOINT);
    await session.restore();
    expect(world.calls.refresh).toBe(1);

    const results = await Promise.all([
      useMeQuery.fetcher(session.client)(),
      useMeQuery.fetcher(session.client)(),
    ]);

    expect(results.map((result) => result.me.name)).toEqual(["小華", "小華"]);
    expect(world.calls.refresh).toBe(2);
    session.dispose();
  });

  it("受保護請求帶 cookie(credentials include)且帶 Bearer token", async () => {
    const world = authWorld({ hasRefreshCookie: true });
    let seenCredentials: RequestCredentials | null = null;
    let seenAuthorization: string | null = null;
    server.use(...world.handlers);
    server.events.on("request:start", ({ request }) => {
      seenCredentials = request.credentials;
      seenAuthorization = request.headers.get("authorization");
    });

    renderApp({ path: "/" });

    expect(await screen.findByText("小華,你好")).toBeInTheDocument();
    expect(seenCredentials).toBe("include");
    expect(seenAuthorization).toBe("Bearer access-2");
  });
});

describe("分頁登出同步(BroadcastChannel)", () => {
  it("其他分頁廣播登出 → 本分頁立即回登入頁", async () => {
    const world = authWorld({ hasRefreshCookie: true });
    server.use(...world.handlers);
    renderApp({ path: "/" });
    expect(await screen.findByText("小華,你好")).toBeInTheDocument();

    const otherTab = new BroadcastChannel(SESSION_CHANNEL_NAME);
    otherTab.postMessage({ type: "logout" });

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/login");
    });
    expect(screen.getByLabelText("帳號")).toBeInTheDocument();
    otherTab.close();
  });

  it("本分頁登出 → 打 api logout、回登入頁、廣播給其他分頁", async () => {
    const world = authWorld({ hasRefreshCookie: true });
    server.use(...world.handlers);
    const { user } = renderApp({ path: "/" });
    expect(await screen.findByText("小華,你好")).toBeInTheDocument();

    const otherTab = new BroadcastChannel(SESSION_CHANNEL_NAME);
    const received = new Promise<unknown>((resolve) => {
      otherTab.addEventListener("message", (event: MessageEvent<unknown>) => {
        resolve(event.data);
      });
    });

    // 登出在 AppBar 的使用者選單裡(登入線5 殼)
    await user.click(screen.getByRole("button", { name: "小華" }));
    await user.click(screen.getByRole("menuitem", { name: "登出" }));

    await expect(received).resolves.toEqual({ type: "logout" });
    expect(world.calls.logout).toBe(1);
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/login");
    });
    otherTab.close();
  });
});
