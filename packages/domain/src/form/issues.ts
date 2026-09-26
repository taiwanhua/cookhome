/** 檢查器的一筆錯誤 / 警告;`location` 讓設計器點擊定位到欄位 / 表達式節點 / 版面格。 */
export interface DefinitionIssue {
  code: DefinitionIssueCode;
  /** 給設計者看的繁中說明。 */
  message: string;
  location: DefinitionIssueLocation;
}

export interface DefinitionIssueLocation {
  fieldKey?: string;
  /** 欄位上的哪個表達式:`valueSource.expr` / `default.expr` / `visibleWhen` / `readonlyWhen` / `rules.custom`。 */
  exprSlot?: ExpressionSlot;
  /** 表達式樹裡的節點位置(`scanExpression` 的 path;根為空字串)。 */
  exprPath?: string;
  /** 版面位置,如 `sections.0.rows.1.cols.0`。 */
  layoutPath?: string;
  summarySlot?: "title" | "date" | "amount";
  prefillIndex?: number;
  /** 欄位上的哪個屬性出錯(`rules.pattern`、`options.items.2.value`…)。 */
  property?: string;
}

export type ExpressionSlot =
  | "valueSource.expr"
  | "default.expr"
  | "visibleWhen"
  | "readonlyWhen"
  | "rules.custom";

/** 錯誤碼(有錯不能發布)。 */
export const DEFINITION_ERROR_CODES = [
  "KEY_DUPLICATE",
  "KEY_FORMAT",
  "KEY_RESERVED",
  "KEY_TYPE_CHANGED",
  "FIELD_TYPE_UNKNOWN",
  "PRECISION_INVALID",
  "EXPR_MISSING",
  "EXPR_UNKNOWN_OPERATOR",
  "EXPR_INVALID",
  "EXPR_INVALID_VAR",
  "EXPR_TOO_DEEP",
  "EXPR_TOO_MANY_NODES",
  "EXPR_UNKNOWN_FIELD",
  "EXPR_CYCLE",
  "EXPR_VISIBLE_SELF",
  "EXPR_PROTECTED_REF",
  "EXPR_TYPE_MISMATCH",
  "EXPR_DATE_DIFF_UNIT",
  "DEFAULT_NOT_ALLOWED",
  "DEFAULT_KIND_INVALID",
  "DEFAULT_VALUE_INVALID",
  "DEFAULT_SELF",
  "DEFAULT_REFERENCE_INVALID",
  "UPLOAD_LIMIT_INVALID",
  "OPTIONS_MISSING",
  "OPTIONS_DUPLICATE_VALUE",
  "OPTIONS_UNKNOWN_CATEGORY",
  "LOOKUP_UNKNOWN_PROVIDER",
  "LOOKUP_UNKNOWN_FIELD",
  "LOOKUP_FORM_KEY_MISSING",
  "ALLOW_CUSTOM_WIDGET",
  "REQUIRED_ALWAYS_HIDDEN",
  "PATTERN_INVALID",
  "PATTERN_UNSAFE",
  "PATTERN_MESSAGE_MISSING",
  "PATTERN_WITH_FORMAT",
  "LAYOUT_MISSING_FIELD",
  "LAYOUT_DUPLICATE_FIELD",
  "LAYOUT_UNKNOWN_FIELD",
  "LAYOUT_SPAN_INVALID",
  "LAYOUT_SECTION_DUPLICATE",
  "SUMMARY_UNMAPPED",
  "SUMMARY_PROTECTED",
  "SUMMARY_TYPE",
  "WIDGET_UNKNOWN",
  "WIDGET_TYPE_MISMATCH",
  "PREFILL_UNKNOWN_SOURCE_FIELD",
  "PREFILL_TYPE_INCOMPATIBLE",
  "PREFILL_TARGET_NOT_INPUT",
  "REFERENCE_SOURCE_MISSING",
] as const;

/** 警告碼(可發布)。 */
export const DEFINITION_WARNING_CODES = [
  "SECTION_EMPTY",
  "PROTECTED_REQUIRED",
  "COMPUTED_HIDDEN",
  "LIST_COLUMN_MISSING",
] as const;

export type DefinitionErrorCode = (typeof DEFINITION_ERROR_CODES)[number];

export type DefinitionWarningCode = (typeof DEFINITION_WARNING_CODES)[number];

export type DefinitionIssueCode = DefinitionErrorCode | DefinitionWarningCode;

export interface ValidationReport {
  errors: DefinitionIssue[];
  warnings: DefinitionIssue[];
}

/** 檢查器各段共用的收集器。 */
export class IssueCollector {
  readonly errors: DefinitionIssue[] = [];
  readonly warnings: DefinitionIssue[] = [];

  error(
    code: DefinitionErrorCode,
    message: string,
    location: DefinitionIssueLocation,
  ): void {
    this.errors.push({ code, message, location });
  }

  warn(
    code: DefinitionWarningCode,
    message: string,
    location: DefinitionIssueLocation,
  ): void {
    this.warnings.push({ code, message, location });
  }
}
