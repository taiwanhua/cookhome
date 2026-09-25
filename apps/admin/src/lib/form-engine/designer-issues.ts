import type {
  DefinitionIssue,
  FormDefinition,
  ValidationReport,
} from "@repo/domain/form";

/**
 * 設計器顯示的檢查結果 = domain 檢查器(`validateDefinition`)的錯誤 / 警告 + admin 自己加的警告。
 * admin 的警告只提醒、不擋發布,code 以 `ADMIN_` 開頭(不是 domain 的錯誤碼)。
 */
export interface DesignerIssue extends Omit<DefinitionIssue, "code"> {
  code: string;
}

export interface DesignerReport {
  errors: DesignerIssue[];
  warnings: DesignerIssue[];
}

/**
 * 「欄位管理類別」選項 + 必填:填寫者要有 `system.field-manager.view` 才拿得到類別選項(執行端沒有
 * 專屬的類別選項查詢),一般員工看得到欄位卻選不了,必填就送不出去。api 補查詢之前先提醒設計者。
 */
export const CATEGORY_REQUIRED_WARNING = "ADMIN_CATEGORY_OPTIONS_REQUIRED";

export const adminWarningsOf = (
  definition: FormDefinition,
  message: (label: string) => string,
): DesignerIssue[] =>
  definition.fields
    .filter(
      (field) =>
        field.options?.kind === "fieldCategory" &&
        field.rules?.required === true,
    )
    .map((field) => ({
      code: CATEGORY_REQUIRED_WARNING,
      message: message(field.label),
      location: { fieldKey: field.key, property: "options" },
    }));

export const withAdminWarnings = (
  report: ValidationReport,
  extra: readonly DesignerIssue[],
): DesignerReport => ({
  errors: report.errors,
  warnings: [...report.warnings, ...extra],
});
