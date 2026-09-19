import { ClientError } from "@repo/graphql";

/**
 * 組織管理會收到的業務錯誤碼(GQL-04;api 的程式正本 `apps/api/src/orgs/org-error.ts`)。
 * 認不出來的一律當 `UNEXPECTED`,文案在 `admin.orgManager.errors.*`。
 */
export const ORG_MANAGER_ERROR_CODES = [
  "ORG_NOT_DELETABLE",
  "CROSS_TENANT",
  "CYCLIC_MOVE",
  "NOT_FOUND",
  "VALIDATION_FAILED",
  "UPLOAD_REJECTED",
  "FORBIDDEN",
] as const;

export type OrgManagerErrorCode =
  (typeof ORG_MANAGER_ERROR_CODES)[number] | "UNEXPECTED";

/** `ORG_NOT_DELETABLE` 的前置檢查項(`extensions.reasons`,逐項顯示成清單)。 */
export const ORG_NOT_DELETABLE_REASONS = [
  "HAS_CHILDREN",
  "HAS_MEMBERS",
  "OWNS_ROLES",
  "HAS_BUSINESS_DATA",
  "SYSTEM_ORG",
] as const;

export type OrgNotDeletableReason = (typeof ORG_NOT_DELETABLE_REASONS)[number];

export interface OrgManagerError {
  code: OrgManagerErrorCode;
  /** `ORG_NOT_DELETABLE` 時逐項列出為什麼不能刪 */
  reasons: OrgNotDeletableReason[];
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

const isKnownCode = (value: unknown): value is OrgManagerErrorCode =>
  typeof value === "string" &&
  (ORG_MANAGER_ERROR_CODES as readonly string[]).includes(value);

const isKnownReason = (value: unknown): value is OrgNotDeletableReason =>
  typeof value === "string" &&
  (ORG_NOT_DELETABLE_REASONS as readonly string[]).includes(value);

const stringsOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

export const orgManagerErrorOf = (error: unknown): OrgManagerError => {
  for (const item of errorsOf(error)) {
    const { code, reasons, fields } = item.extensions ?? {};
    if (isKnownCode(code)) {
      return {
        code,
        reasons: Array.isArray(reasons) ? reasons.filter(isKnownReason) : [],
        fields: stringsOf(fields),
      };
    }
  }
  return { code: "UNEXPECTED", reasons: [], fields: [] };
};
