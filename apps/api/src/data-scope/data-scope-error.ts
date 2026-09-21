import { GraphQLError } from "graphql";

import type { RuleViolation } from "./data-scope-rule";

/**
 * 資料範圍的業務錯誤碼(GQL-04:`extensions.code` 列舉值;清單正本
 * `docs/standards/api/graphql-schema.md`)。沿用的通用碼(`FORBIDDEN` / `NOT_FOUND`)不重複宣告。
 */
export const DATA_SCOPE_ERROR_CODES = [
  /** 規則不合法:欄位不存在、運算子不符型別、值來源不符型別…(ADR-0008) */
  "RULE_INVALID",
] as const;

/**
 * 規則不合法(`RULE_INVALID`):`extensions.path` 指到條件樹裡出問題的位置
 * (如 `rules[0].filter.children[1].value`),`extensions.reason` 是原因列舉
 * (`RULE_INVALID_REASONS`)。前端把錯誤標在該條件列上,不必自己再解析一次規則。
 */
export function ruleInvalidError(violation: RuleViolation): GraphQLError {
  return new GraphQLError(
    `Invalid data scope rule at ${violation.path}: ${violation.detail}`,
    {
      extensions: {
        code: "RULE_INVALID",
        path: violation.path,
        reason: violation.reason,
      },
    },
  );
}

/** 資料目標不在 `data_scope_targets`(沒有模組 seed 宣告它,GQL-04 `NOT_FOUND`)。 */
export function targetNotFoundError(collection: string): GraphQLError {
  return new GraphQLError(
    `Data scope target ${collection} is not declared by any module seed`,
    { extensions: { code: "NOT_FOUND" } },
  );
}

/** 非根組織的操作者即使持有權限也不得進「資料範圍」(GQL-04 `FORBIDDEN`;模組 isRootOnly)。 */
export function rootOnlyError(action: string): GraphQLError {
  return new GraphQLError(`${action} is only available from the root org`, {
    extensions: { code: "FORBIDDEN" },
  });
}
