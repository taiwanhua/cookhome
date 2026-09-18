import { ClientError } from "@repo/graphql";

/**
 * GQL-04 的登入線錯誤碼(正本 `docs/standards/api/graphql-schema.md`;api 的程式正本 `apps/api/src/auth/auth-error.ts`)。
 * GraphQL 永遠回 HTTP 200,前端只靠 `extensions.code` 分流。
 */
export const AUTH_ERROR_CODES = [
  "UNAUTHENTICATED",
  "TOKEN_EXPIRED",
  "FORBIDDEN",
  "INVALID_CREDENTIALS",
  "ACCOUNT_DISABLED",
  "TOO_MANY_ATTEMPTS",
  "MUST_CHANGE_PASSWORD",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

/** 收到即代表「登入狀態已無效」的碼:清狀態、回登入頁(GQL-04)。 */
const SESSION_ENDED_CODES: ReadonlySet<AuthErrorCode> = new Set([
  "UNAUTHENTICATED",
  "ACCOUNT_DISABLED",
]);

interface GraphqlErrorShape {
  extensions?: { code?: unknown };
}

function isAuthErrorCode(value: unknown): value is AuthErrorCode {
  return (
    typeof value === "string" &&
    (AUTH_ERROR_CODES as readonly string[]).includes(value)
  );
}

/** 從 GraphQL 回應 body 的 `errors[]` 取出第一個登入線錯誤碼;沒有則 null。 */
export function authErrorCodeOfBody(body: unknown): AuthErrorCode | null {
  if (typeof body !== "object" || body === null || !("errors" in body)) {
    return null;
  }
  const { errors } = body as { errors?: unknown };
  if (!Array.isArray(errors)) {
    return null;
  }
  for (const error of errors as GraphqlErrorShape[]) {
    const code = error.extensions?.code;
    if (isAuthErrorCode(code)) {
      return code;
    }
  }
  return null;
}

/** 從 codegen hook 拋出的錯誤(graphql-request 的 ClientError)取出登入線錯誤碼。 */
export function authErrorCodeOf(error: unknown): AuthErrorCode | null {
  return error instanceof ClientError
    ? authErrorCodeOfBody(error.response)
    : null;
}

export function isSessionEndedCode(code: AuthErrorCode | null): boolean {
  return code !== null && SESSION_ENDED_CODES.has(code);
}
