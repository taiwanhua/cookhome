import { type GraphQLResponseBody, HttpResponse } from "msw";

import type { MeQuery } from "@repo/graphql";

import { api } from "./server";

/** GQL-04 的錯誤碼(前端只靠它分流);api 的正本 `apps/api/src/auth/auth-error.ts`。 */
export type AuthErrorCode =
  | "UNAUTHENTICATED"
  | "TOKEN_EXPIRED"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_DISABLED"
  | "TOO_MANY_ATTEMPTS"
  | "FORBIDDEN"
  | "MUST_CHANGE_PASSWORD";

type ErrorBody = GraphQLResponseBody<Record<string, never>>;

/** 以 GQL-04 形式回業務錯誤:HTTP 200 + `errors[].extensions.code`。 */
export function graphqlError(code: AuthErrorCode, message: string = code) {
  return HttpResponse.json<ErrorBody>({
    data: null,
    errors: [{ message, extensions: { code } }],
  });
}

export type TestModule = MeQuery["me"]["modules"][number];

export const testUser: MeQuery["me"] = {
  id: "user-1",
  account: "root",
  name: "小華",
  email: "root@cookhome.online",
  nickname: null,
  mustChangePassword: false,
  currentOrg: { id: "org-1", name: "CookHome" },
  orgs: [{ id: "org-1", name: "CookHome" }],
  modules: [],
};

export function bearerOf(request: Request): string | null {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

export interface AuthWorldOptions {
  /** 一開始就有有效的 refresh cookie(模擬「重新整理頁面」);預設沒有 */
  hasRefreshCookie?: boolean;
  /** Login 發的 access token */
  accessToken?: string;
  /** Refresh 依序發的 access token(用完重複最後一個) */
  refreshedTokens?: string[];
  /** 帶這些 token 的受保護請求回 TOKEN_EXPIRED */
  expiredTokens?: string[];
  /** `me.modules`(預設空) */
  modules?: TestModule[];
}

export interface AuthWorld {
  handlers: ReturnType<typeof api.mutation>[];
  /** 各操作被打到的次數(驗證「只重試一次」「refresh 只打一次」) */
  calls: { login: number; refresh: number; me: number; logout: number };
}

/**
 * 「登入線」的假 api(httpOnly cookie 用 `hasRefreshCookie` 旗標模擬,jsdom 看不到真 cookie):
 * - Login:任何帳密都成功,發 `accessToken` 並「種下」refresh cookie
 * - Refresh:有 cookie 才依序發 `refreshedTokens`;沒有回 UNAUTHENTICATED
 * - Logout / LogoutAllDevices:清 cookie
 * - Me:帶有效 bearer 才回使用者;沒帶回 UNAUTHENTICATED;在 `expiredTokens` 內回 TOKEN_EXPIRED
 */
export function authWorld(options: AuthWorldOptions = {}): AuthWorld {
  const {
    accessToken = "access-1",
    refreshedTokens = ["access-2"],
    expiredTokens = [],
    modules = [],
  } = options;
  let hasRefreshCookie = options.hasRefreshCookie ?? false;
  const validTokens = new Set([accessToken, ...refreshedTokens]);
  const calls = { login: 0, refresh: 0, me: 0, logout: 0 };
  const me: MeQuery["me"] = { ...testUser, modules };

  const handlers = [
    api.mutation("Login", () => {
      calls.login += 1;
      hasRefreshCookie = true;
      return HttpResponse.json({ data: { login: { accessToken } } });
    }),
    api.mutation("Refresh", () => {
      calls.refresh += 1;
      if (!hasRefreshCookie) {
        return graphqlError("UNAUTHENTICATED", "Invalid refresh token");
      }
      const index = Math.min(calls.refresh, refreshedTokens.length) - 1;
      return HttpResponse.json({
        data: { refresh: { accessToken: refreshedTokens[index] } },
      });
    }),
    api.mutation("Logout", () => {
      calls.logout += 1;
      hasRefreshCookie = false;
      return HttpResponse.json({ data: { logout: { success: true } } });
    }),
    api.mutation("LogoutAllDevices", () => {
      hasRefreshCookie = false;
      return HttpResponse.json({
        data: { logoutAllDevices: { success: true } },
      });
    }),
    api.query("Me", ({ request }) => {
      calls.me += 1;
      const token = bearerOf(request);
      if (token === null) {
        return graphqlError("UNAUTHENTICATED", "Missing access token");
      }
      if (expiredTokens.includes(token)) {
        return graphqlError("TOKEN_EXPIRED", "Access token expired");
      }
      if (!validTokens.has(token)) {
        return graphqlError("UNAUTHENTICATED", "Invalid access token");
      }
      return HttpResponse.json({ data: { me } });
    }),
  ];

  return { handlers, calls };
}

/** 只要 handler、不需要計數時的簡寫。 */
export function authHandlers(options: AuthWorldOptions = {}) {
  return authWorld(options).handlers;
}
