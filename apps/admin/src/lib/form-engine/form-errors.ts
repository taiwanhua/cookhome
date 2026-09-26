import { ClientError } from "@repo/graphql";

import { type AdminError, parseAdminError } from "@/lib/errors";

/**
 * 表單引擎(設計端與執行端)會收到的錯誤(正本 docs/modules/forms.md「錯誤」):
 * 通用碼照 GQL-04,另有 `CONFLICT`(規格寫的「409」)與 `PERMISSION_NOT_DELETABLE`。
 * 文案在 `admin.formEngine.errors.<code>`(設計端另有 `admin.forms.errors`),認不出來的一律 `UNEXPECTED`。
 *
 * `FORBIDDEN` 依 `reason` 細分:欄位級守門(`FIELD_FORBIDDEN`)、表單現在不能新增(`FORM_NOT_AVAILABLE`)、
 * 不是自己的表單(`NOT_FORM_OWNER`)、只有平台能做(`ROOT_ONLY`),以及送出時檢查擋下
 * (綁定的流程已移除 / 尚未發布 / 設定有誤:`WORKFLOW_*`,docs/modules/workflows.md「錯誤」)。
 */
export const FORM_ERROR_CODES = [
  "CONFLICT",
  "FIELD_FORBIDDEN",
  "FORM_NOT_AVAILABLE",
  "NOT_FORM_OWNER",
  "ROOT_ONLY",
  "WORKFLOW_REMOVED",
  "WORKFLOW_UNPUBLISHED",
  "WORKFLOW_MISCONFIGURED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_FAILED",
  "PERMISSION_NOT_DELETABLE",
] as const;

export type FormErrorCode = (typeof FORM_ERROR_CODES)[number] | "UNEXPECTED";

/** `CONFLICT` 的 reason(樂觀鎖 / 搶鎖);`PERMISSION_NOT_DELETABLE` 的 reasons。 */
export const FORM_ERROR_REASONS = [
  "DRAFT_REVISION_MISMATCH",
  "DRAFT_EXISTS",
  "DRAFT_MISSING",
  "PUBLISH_IN_PROGRESS",
  "PUBLISH_NOT_INTERRUPTED",
  "NO_CURRENT_VERSION",
  "CURRENT_VERSION_CHANGED",
  "EDIT_VERSION_MISMATCH",
  "REVISION_MISMATCH",
  "STATUS_MISMATCH",
  "CLIENT_REQUEST_REUSED",
  "NOT_DYNAMIC",
  "NOT_RETIRED",
  "USED_BY_DRAFTS",
  "CONFIRM_REQUIRED",
] as const;

export type FormErrorReason = (typeof FORM_ERROR_REASONS)[number];

/** 值錯誤(`VALIDATION_FAILED` 的 `extensions.fieldErrors`)。 */
export interface FormFieldErrorLike {
  fieldKey: string;
  code: string;
  message: string;
}

/** 定義錯誤(`VALIDATION_FAILED` + `fields: ["definition"]` 的 `extensions.issues`)。 */
export interface FormIssueLike {
  code: string;
  message: string;
  location: Record<string, unknown>;
}

/** 退役權限清理的使用狀況(`PERMISSION_NOT_DELETABLE` 的 `extensions.usage`)。 */
export interface PermissionUsageLike {
  draftCount: number;
  draftVersions: number[];
  completedCount: number;
  completedVersions: number[];
}

export interface FormError extends AdminError<FormErrorCode, FormErrorReason> {
  fieldErrors?: FormFieldErrorLike[];
  issues?: FormIssueLike[];
  usage?: PermissionUsageLike;
}

const FORBIDDEN_REASONS: Partial<
  Record<string, (typeof FORM_ERROR_CODES)[number]>
> = {
  FIELD_FORBIDDEN: "FIELD_FORBIDDEN",
  FORM_NOT_AVAILABLE: "FORM_NOT_AVAILABLE",
  NOT_FORM_OWNER: "NOT_FORM_OWNER",
  ROOT_ONLY: "ROOT_ONLY",
  WORKFLOW_REMOVED: "WORKFLOW_REMOVED",
  WORKFLOW_UNPUBLISHED: "WORKFLOW_UNPUBLISHED",
  WORKFLOW_MISCONFIGURED: "WORKFLOW_MISCONFIGURED",
};

const extensionsOf = (error: unknown): Record<string, unknown> => {
  if (!(error instanceof ClientError)) {
    return {};
  }
  const { errors } = error.response as {
    errors?: { extensions?: Record<string, unknown> }[];
  };
  return errors?.[0]?.extensions ?? {};
};

export const formErrorOf = (error: unknown): FormError => {
  const parsed = parseAdminError<
    Exclude<FormErrorCode, "UNEXPECTED">,
    FormErrorReason
  >(error, {
    codes: FORM_ERROR_CODES,
    reasons: FORM_ERROR_REASONS,
    refine: (code, reason) =>
      code === "FORBIDDEN" && typeof reason === "string"
        ? FORBIDDEN_REASONS[reason]
        : undefined,
  });
  const extensions = extensionsOf(error);
  const fieldErrors = Array.isArray(extensions.fieldErrors)
    ? (extensions.fieldErrors as FormFieldErrorLike[])
    : undefined;
  const issues = Array.isArray(extensions.issues)
    ? (extensions.issues as FormIssueLike[])
    : undefined;
  const usage = extensions.usage as PermissionUsageLike | undefined;
  return {
    ...parsed,
    ...(fieldErrors !== undefined && { fieldErrors }),
    ...(issues !== undefined && { issues }),
    ...(usage !== undefined && { usage }),
  };
};

/** 樂觀鎖 / 搶鎖沒搶到:畫面一律提示「已被更新,請重新載入」。 */
export const isConflict = (error: FormError | null): boolean =>
  error?.code === "CONFLICT";
