import { ClientError } from "@repo/graphql";

/**
 * 角色管理會收到的業務錯誤碼(GQL-04;api 的程式正本 `apps/api/src/roles/`)。
 * 認不出來的一律當 `UNEXPECTED`,文案在 `admin.roleManager.errors.*`。
 */
export const ROLE_MANAGER_ERROR_CODES = [
  "ROLE_NOT_DELETABLE",
  "ROLE_OUT_OF_REACH",
  "USER_NOT_ELIGIBLE",
  "OWNER_PROTECTED",
  "NOT_FOUND",
  "FORBIDDEN",
  "VALIDATION_FAILED",
] as const;

export type RoleManagerErrorCode =
  (typeof ROLE_MANAGER_ERROR_CODES)[number] | "UNEXPECTED";

/**
 * `ROLE_NOT_DELETABLE` 的三個前置檢查(`extensions.reasons`,逐項顯示成清單;
 * 正本 `docs/modules/role-manager.md`「api 介面」與 `roles.graphql` 的註解)。
 */
export const ROLE_NOT_DELETABLE_REASONS = [
  "HAS_GRANTS",
  "SYSTEM_ROLE",
  "TEMPLATE_COPY",
] as const;

export type RoleNotDeletableReason =
  (typeof ROLE_NOT_DELETABLE_REASONS)[number];

export interface RoleManagerError {
  code: RoleManagerErrorCode;
  /** `ROLE_NOT_DELETABLE` 時逐項列出為什麼不能刪 */
  reasons: RoleNotDeletableReason[];
  /** `VALIDATION_FAILED` 時 api 以 `extensions.fields` 指出不合法的欄位 */
  fields: string[];
}

interface GraphqlErrorShape {
  extensions?: { code?: unknown; reasons?: unknown; fields?: unknown };
}

const errorsOf = (error: unknown): GraphqlErrorShape[] => {
  if (!(error instanceof ClientError)) {
    return [];
  }
  const { errors } = error.response as { errors?: unknown };
  return Array.isArray(errors) ? (errors as GraphqlErrorShape[]) : [];
};

const isKnownCode = (value: unknown): value is RoleManagerErrorCode =>
  typeof value === "string" &&
  (ROLE_MANAGER_ERROR_CODES as readonly string[]).includes(value);

const isKnownReason = (value: unknown): value is RoleNotDeletableReason =>
  typeof value === "string" &&
  (ROLE_NOT_DELETABLE_REASONS as readonly string[]).includes(value);

const stringsOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

export const roleManagerErrorOf = (error: unknown): RoleManagerError => {
  for (const item of errorsOf(error)) {
    const { code, reasons, fields } = item.extensions ?? {};
    if (isKnownCode(code)) {
      return {
        code,
        reasons: stringsOf(reasons).filter((reason) => isKnownReason(reason)),
        fields: stringsOf(fields),
      };
    }
  }
  return { code: "UNEXPECTED", reasons: [], fields: [] };
};
