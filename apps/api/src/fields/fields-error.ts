import { GraphQLError } from "graphql";

/**
 * 欄位管理的業務錯誤碼(GQL-04:`extensions.code` 列舉值;清單正本 docs/standards/api/graphql-schema.md)。
 * message 給開發者看(英文);使用者文案由前端依 code 對應。
 * 沿用的通用碼(`FORBIDDEN` / `NOT_FOUND` / `VALIDATION_FAILED`)不重複宣告於此。
 */
export const FIELD_ERROR_CODES = [
  /** 同一類別下 value 重複(同組織已有,或與該類別的全域選項相同);field-manager.md「待辦」 */
  "FIELD_VALUE_DUPLICATE",
] as const;

export type FieldErrorCode = (typeof FIELD_ERROR_CODES)[number];

/** `extensions.fields` 讓前端把錯誤標回表單的「值」欄位(與 VALIDATION_FAILED 同慣例)。 */
export function fieldValueDuplicateError(message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: "FIELD_VALUE_DUPLICATE", fields: ["value"] },
  });
}

/** 查的類別 / 選項在操作者可見範圍內不存在(GQL-04 `NOT_FOUND`)。 */
export function notFoundError(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: "NOT_FOUND" } });
}

/** 有登入但做了不被允許的事(GQL-04 `FORBIDDEN`):改種子選項、碰別的組織的自訂選項。 */
export function forbiddenError(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
}

/** 輸入不合法(GQL-04 `VALIDATION_FAILED`):`extensions.fields` 列出有問題的欄位。 */
export function validationError(
  message: string,
  fields: string[],
): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: "VALIDATION_FAILED", fields },
  });
}
