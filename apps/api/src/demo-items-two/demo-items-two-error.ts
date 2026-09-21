import { GraphQLError } from "graphql";

/**
 * 示範模組2 的業務錯誤(GQL-04)。
 *
 * **不新增任何 code**:對照組只用得到兩個通用碼 —— 這本身就是示範,
 * 「模組長出來不等於要長出自己的錯誤碼」(碼清單正本 `docs/standards/api/graphql-schema.md`)。
 * `FORBIDDEN` 由 `@RequirePermission` 的守門器統一丟,本檔不重複一份。
 */

/** 查的項目在操作者可見範圍內不存在(含已軟刪除者)。 */
export function notFoundError(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: "NOT_FOUND" } });
}

/** 輸入不合法;`extensions.fields` 讓前端把錯誤標回表單欄位。 */
export function validationError(
  message: string,
  fields: string[],
): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: "VALIDATION_FAILED", fields },
  });
}
