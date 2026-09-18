import { GraphQLError } from "graphql";

/**
 * 登入線的業務錯誤碼(GQL-04:`extensions.code` 列舉值;清單正本 docs/standards/api/graphql-schema.md)。
 * message 給開發者看(英文);使用者文案由前端依 code 對應。
 */
export const AUTH_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "INVALID_CREDENTIALS",
  "ACCOUNT_DISABLED",
  "TOO_MANY_ATTEMPTS",
  "TOKEN_EXPIRED",
  "MUST_CHANGE_PASSWORD",
  /** 信件連結的 token 失效(不存在 / 已用 / 逾期,三者同碼不透露差別)→ 前端導連結失效頁,不是換票 */
  "ACTION_TOKEN_INVALID",
  /** 已登入者改密碼時「目前密碼」錯 → 前端文案「目前密碼錯誤」(本人操作,無枚舉風險) */
  "CURRENT_PASSWORD_INVALID",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export function authError(code: AuthErrorCode, message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}
