import { QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { type AuthSession, createAuthSession } from "../lib/auth/session";
import { TEST_GRAPHQL_ENDPOINT } from "./msw/server";
import { TestApp } from "./test-app";

export interface RenderAppOptions {
  /** 起始網址(含 query),預設首頁 */
  path?: string;
  /** 共用同一個 session(模擬「同一分頁內」的連續操作);不給就新建 */
  session?: AuthSession;
  /** 額外掛在 providers 內、路由旁的探針元件(測 hooks 用) */
  extra?: ReactNode;
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

/**
 * 以完整的 providers + 路由渲染 app(組裝見 `TestApp`,與 root.tsx 相同,只把 BrowserRouter 換成 MemoryRouter)。
 * 回傳的 `session` 可讓測試在同一分頁語意下重新渲染或直接呼叫 client。
 */
export function renderApp({
  path = "/",
  session,
  extra,
}: RenderAppOptions = {}) {
  const activeSession = session ?? createAuthSession(TEST_GRAPHQL_ENDPOINT);
  const queryClient = createTestQueryClient();
  const user = userEvent.setup();
  const view = render(
    <TestApp
      path={path}
      session={activeSession}
      queryClient={queryClient}
      extra={extra}
    />,
  );
  return { ...view, user, session: activeSession, queryClient };
}
