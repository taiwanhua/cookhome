import { ClientError } from "@repo/graphql";

import {
  RULE_INVALID_REASONS,
  type RuleInvalidReason,
} from "@/lib/data-scope-issues";

/**
 * 資料範圍會收到的業務錯誤碼(GQL-04;api 的程式正本 `apps/api/src/data-scope/data-scope-error.ts`)。
 * 認不出來的一律當 `UNEXPECTED`,文案在 `admin.dataScope.errors.*`。
 */
export const DATA_SCOPE_ERROR_CODES = [
  "RULE_INVALID",
  "NOT_FOUND",
  "FORBIDDEN",
] as const;

export type DataScopeErrorCode =
  | (typeof DATA_SCOPE_ERROR_CODES)[number]
  | "UNEXPECTED";

export interface DataScopeError {
  code: DataScopeErrorCode;
  /** `RULE_INVALID` 才有:指到條件樹裡出問題的位置(`rules[0].filter.children[1].value`) */
  path: string | null;
  /** `RULE_INVALID` 才有:原因列舉,前端依它顯示中文 */
  reason: RuleInvalidReason | null;
}

interface GraphqlErrorShape {
  extensions?: { code?: unknown; path?: unknown; reason?: unknown };
}

const errorsOf = (error: unknown): GraphqlErrorShape[] => {
  if (!(error instanceof ClientError)) {
    return [];
  }
  const { errors } = error.response as { errors?: unknown };
  return Array.isArray(errors) ? (errors as GraphqlErrorShape[]) : [];
};

const isKnownCode = (value: unknown): value is DataScopeErrorCode =>
  typeof value === "string" &&
  (DATA_SCOPE_ERROR_CODES as readonly string[]).includes(value);

const isKnownReason = (value: unknown): value is RuleInvalidReason =>
  typeof value === "string" &&
  (RULE_INVALID_REASONS as readonly string[]).includes(value);

export const dataScopeErrorOf = (error: unknown): DataScopeError => {
  for (const item of errorsOf(error)) {
    const { code, path, reason } = item.extensions ?? {};
    if (isKnownCode(code)) {
      return {
        code,
        path: typeof path === "string" ? path : null,
        reason: isKnownReason(reason) ? reason : null,
      };
    }
  }
  return { code: "UNEXPECTED", path: null, reason: null };
};
