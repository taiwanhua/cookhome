import { type GraphQLResponseBody, HttpResponse } from "msw";

import { validatePassword } from "@repo/domain/password";
import type {
  ChangePasswordMutationVariables,
  MeQuery,
  RequestPasswordResetMutationVariables,
  SetPasswordMutationVariables,
} from "@repo/graphql";

import { api } from "./server";

/** GQL-04 的錯誤碼(前端只靠它分流);api 的正本 `apps/api/src/auth/auth-error.ts`。 */
export type AuthErrorCode =
  | "UNAUTHENTICATED"
  | "TOKEN_EXPIRED"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_DISABLED"
  | "TOO_MANY_ATTEMPTS"
  | "FORBIDDEN"
  | "MUST_CHANGE_PASSWORD"
  | "ACTION_TOKEN_INVALID"
  | "CURRENT_PASSWORD_INVALID"
  | "VALIDATION_FAILED";

type ErrorBody = GraphQLResponseBody<Record<string, never>>;

/** 以 GQL-04 形式回業務錯誤:HTTP 200 + `errors[].extensions.code`(`extensions` 可附加如 `violations`)。 */
export function graphqlError(
  code: AuthErrorCode,
  message: string = code,
  extensions: Record<string, unknown> = {},
) {
  return HttpResponse.json<ErrorBody>({
    data: null,
    errors: [{ message, extensions: { ...extensions, code } }],
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
  /** 首登須改密碼(預設 false):true 時除 me / changePassword / logout 外的受保護操作回 MUST_CHANGE_PASSWORD */
  mustChangePassword?: boolean;
  /** 使用者目前的密碼(changePassword 驗「目前密碼」用) */
  currentPassword?: string;
  /** 信件連結裡仍有效的 token(setPassword 用;用過即失效) */
  validActionTokens?: string[];
  /** setPassword 成功後發的 access token */
  setPasswordAccessToken?: string;
}

export interface AuthWorld {
  handlers: ReturnType<typeof api.mutation>[];
  /** 各操作被打到的次數(驗證「只重試一次」「refresh 只打一次」「違規不送出」) */
  calls: {
    login: number;
    refresh: number;
    me: number;
    logout: number;
    requestPasswordReset: number;
    setPassword: number;
    changePassword: number;
  };
  /** requestPasswordReset 收到的 email(依序) */
  resetRequests: string[];
}

/**
 * 「登入線」的假 api(httpOnly cookie 用 `hasRefreshCookie` 旗標模擬,jsdom 看不到真 cookie):
 * - Login:任何帳密都成功,發 `accessToken` 並「種下」refresh cookie
 * - Refresh:有 cookie 才依序發 `refreshedTokens`;沒有回 UNAUTHENTICATED
 * - Logout / LogoutAllDevices:清 cookie
 * - Me:帶有效 bearer 才回使用者;沒帶回 UNAUTHENTICATED;在 `expiredTokens` 內回 TOKEN_EXPIRED
 * - RequestPasswordReset:任何 email 都回成功(api 不透露帳號是否存在)
 * - SetPassword:token 在 `validActionTokens` 內才成功(用過即失效),否則 ACTION_TOKEN_INVALID;
 *   密碼不符規則回 VALIDATION_FAILED + violations;成功發 token、種 cookie、清 mustChangePassword
 * - ChangePassword:要有效 bearer;目前密碼不對回 CURRENT_PASSWORD_INVALID;成功清 mustChangePassword
 * - Recipes(代表「其他受保護操作」):mustChangePassword 時回 MUST_CHANGE_PASSWORD
 */
export function authWorld(options: AuthWorldOptions = {}): AuthWorld {
  const {
    accessToken = "access-1",
    refreshedTokens = ["access-2"],
    expiredTokens = [],
    modules = [],
    currentPassword = "secret-1234",
    validActionTokens = ["token-1"],
    setPasswordAccessToken = "access-set",
  } = options;
  let hasRefreshCookie = options.hasRefreshCookie ?? false;
  let mustChangePassword = options.mustChangePassword ?? false;
  const validTokens = new Set([
    accessToken,
    ...refreshedTokens,
    setPasswordAccessToken,
  ]);
  const actionTokens = new Set(validActionTokens);
  const calls = {
    login: 0,
    refresh: 0,
    me: 0,
    logout: 0,
    requestPasswordReset: 0,
    setPassword: 0,
    changePassword: 0,
  };
  const resetRequests: string[] = [];
  const me: MeQuery["me"] = { ...testUser, modules };

  /** 受保護操作共用的守門(對應 api 的 AuthGuard):回 null 代表放行 */
  const guard = (request: Request, allowMustChange = false) => {
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
    if (mustChangePassword && !allowMustChange) {
      return graphqlError("MUST_CHANGE_PASSWORD", "Password change required");
    }
    return null;
  };

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
      return (
        guard(request, true) ??
        HttpResponse.json({ data: { me: { ...me, mustChangePassword } } })
      );
    }),
    api.query("Recipes", ({ request }) => {
      return guard(request) ?? HttpResponse.json({ data: { recipes: [] } });
    }),
    api.mutation("RequestPasswordReset", ({ variables }) => {
      calls.requestPasswordReset += 1;
      const { input } = variables as RequestPasswordResetMutationVariables;
      resetRequests.push(input.email);
      return HttpResponse.json({
        data: { requestPasswordReset: { success: true } },
      });
    }),
    api.mutation("SetPassword", ({ variables }) => {
      calls.setPassword += 1;
      const { token, newPassword } = (variables as SetPasswordMutationVariables)
        .input;
      if (!actionTokens.has(token)) {
        return graphqlError("ACTION_TOKEN_INVALID", "Action token invalid");
      }
      const violations = validatePassword(newPassword);
      if (violations.length > 0) {
        return graphqlError("VALIDATION_FAILED", "Password rules", {
          violations,
        });
      }
      actionTokens.delete(token);
      hasRefreshCookie = true;
      mustChangePassword = false;
      return HttpResponse.json({
        data: { setPassword: { accessToken: setPasswordAccessToken } },
      });
    }),
    api.mutation("ChangePassword", ({ request, variables }) => {
      calls.changePassword += 1;
      const denied = guard(request, true);
      if (denied !== null) {
        return denied;
      }
      const { input } = variables as ChangePasswordMutationVariables;
      if (input.currentPassword !== currentPassword) {
        return graphqlError(
          "CURRENT_PASSWORD_INVALID",
          "Current password invalid",
        );
      }
      const violations = validatePassword(input.newPassword);
      if (violations.length > 0) {
        return graphqlError("VALIDATION_FAILED", "Password rules", {
          violations,
        });
      }
      mustChangePassword = false;
      return HttpResponse.json({ data: { changePassword: { success: true } } });
    }),
  ];

  return { handlers, calls, resetRequests };
}

/** 只要 handler、不需要計數時的簡寫。 */
export function authHandlers(options: AuthWorldOptions = {}) {
  return authWorld(options).handlers;
}
