import { GraphQLError } from "graphql";

import {
  type PasswordRuleViolation,
  validatePassword,
} from "@repo/domain/password";

/**
 * 密碼不符規則 → `VALIDATION_FAILED`(GQL-04),`extensions.violations` 列出違規項
 * (`too-short` / `digits-only`;規則正本 `@repo/domain/password`,admin 表單用同一份即時提示)。
 */
export function passwordValidationError(
  violations: PasswordRuleViolation[],
): GraphQLError {
  return new GraphQLError(
    `Password does not meet the rules: ${violations.join(", ")}`,
    { extensions: { code: "VALIDATION_FAILED", violations } },
  );
}

export function assertPasswordRule(password: string): void {
  const violations = validatePassword(password);
  if (violations.length > 0) {
    throw passwordValidationError(violations);
  }
}
