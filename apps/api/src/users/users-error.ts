import { GraphQLError } from "graphql";

/**
 * 使用者管理的業務錯誤碼(GQL-04:`extensions.code` 列舉值;清單正本 docs/standards/api/graphql-schema.md)。
 * message 給開發者看(英文);使用者文案由前端依 code 對應。
 * 沿用的通用碼(`FORBIDDEN` / `NOT_FOUND` / `VALIDATION_FAILED`)不重複宣告於此。
 */
export const USER_ERROR_CODES = [
  /** 最後一個所屬組織不可移除(使用者至少要有一個所屬組織,ADR-0003) */
  "LAST_ORG",
  /** 防越權:操作者只能授予自己持有的角色(ADR-0003) */
  "ROLE_OUT_OF_REACH",
  /** 擁有者保護:租戶擁有者不可停用 / 移出租戶 / 解除其租戶管理員授予(ADR-0009;根組織操作者例外) */
  "OWNER_PROTECTED",
] as const;

export type UserErrorCode = (typeof USER_ERROR_CODES)[number];

export function userError(code: UserErrorCode, message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}

/** 查的使用者 / 組織 / 角色在操作者可見範圍內不存在(GQL-04 `NOT_FOUND`)。 */
export function notFoundError(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: "NOT_FOUND" } });
}

/** 有登入但做了不被允許的事(GQL-04 `FORBIDDEN`):缺欄位級權限、碰可見範圍外的組織。 */
export function forbiddenError(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
}

/**
 * 輸入不合法(GQL-04 `VALIDATION_FAILED`):`extensions.fields` 列出有問題的欄位,
 * 前端據此把錯誤標在對應的表單欄位上(如帳號 / Email 重複)。
 */
export function validationError(
  message: string,
  fields: string[],
): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: "VALIDATION_FAILED", fields },
  });
}
