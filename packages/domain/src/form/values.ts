import { roundToPrecision, toDecimal } from "./decimal";
import { evaluateCondition } from "./expression";
import type {
  ExpressionContext,
  FieldDef,
  FieldType,
  StoredValues,
} from "./types";
import { PATTERN_FLAGS } from "./validate-fields";

/**
 * 提交的**值**(`form_submissions.values`)的型別正規化與規則驗證(Spec §5「值的存法」、`rules`)。
 * 前後端共用:api 在存草稿 / 送出 / 已完成修改時跑,admin 在畫面上即時提示用同一份。
 *
 * 分兩層:
 * - `normalizeFieldValue`:**型別**(草稿也驗)—— 把送來的值收成存值形狀,形狀不對 → `TYPE_INVALID`
 * - `validateFieldRules`:**完成資料所需的驗證**(必填 / 範圍 / 長度 / 格式 / custom)—— 草稿不跑
 *
 * 選項是否在清單內(靜態 / 欄位管理類別 / lookup)要查資料或比對既有值,由 api 驗,不在這裡。
 */

export const VALUE_ISSUE_CODES = [
  "TYPE_INVALID",
  "REQUIRED",
  "NOT_COMPUTABLE",
  "MIN",
  "MAX",
  "MIN_LENGTH",
  "MAX_LENGTH",
  "PATTERN",
  "FORMAT",
  "OPTION_INVALID",
  "SOURCE_UNAVAILABLE",
  "UPLOAD_INVALID",
  "CUSTOM",
] as const;

export type ValueIssueCode = (typeof VALUE_ISSUE_CODES)[number];

/** 一欄的值錯誤;`message` 是給填寫者看的繁中說明(`patternMessage` 有設就用它)。 */
export interface ValueIssue {
  fieldKey: string;
  code: ValueIssueCode;
  message: string;
}

/** 選項欄的存值(類別 / lookup 選項、`allowCustom` 自訂值;靜態選項只存 `value` 字串)。 */
export interface StoredOption {
  value: string;
  label: string | null;
  custom?: boolean;
}

/** 引用欄的存值:來源 id + 送出當時的顯示名快照。 */
export interface StoredReference {
  id: string;
  label: string | null;
}

/** 上傳欄的存值(路徑是否為本 API 簽出來的由 api 驗)。 */
export interface StoredUpload {
  path: string;
  name: string;
  size: number;
  contentType: string;
}

export type NormalizeResult =
  { ok: true; value: unknown } | { ok: false; issue: ValueIssue };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const NUMERIC_STRING = /^-?\d+(?:\.\d+)?$/;

/** 空值:null / undefined / 空字串 / 空陣列。必填判斷與正規化都以它為準。 */
export function isEmptyValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function typeIssue(field: FieldDef, detail: string): NormalizeResult {
  return {
    ok: false,
    issue: {
      fieldKey: field.key,
      code: "TYPE_INVALID",
      message: `「${field.label}」的值格式不正確(${detail})`,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `YYYY-MM-DD` 且是存在的日期(不接受 2026-02-30)。 */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

/**
 * 選項的一個值:字串或 `{ value, label?, custom? }` → `{ value, label, custom }`;形狀不對回 null。
 * label 由 api 送出時重取,這裡先收下送來的(沒有就 null)。
 */
function optionOf(raw: unknown): StoredOption | null {
  if (typeof raw === "string") {
    return { value: raw, label: null };
  }
  if (isRecord(raw) && typeof raw.value === "string") {
    const label = typeof raw.label === "string" ? raw.label : null;
    return raw.custom === true
      ? { value: raw.value, label: label ?? raw.value, custom: true }
      : { value: raw.value, label };
  }
  return null;
}

/**
 * 選項欄的存值:靜態選項只存 `value` 字串;類別 / lookup 選項與 `allowCustom` 打進來的存
 * `{ value, label }`(自訂值另標 `custom: true`)。多選逐項收進 `stored`。
 */
function pushStoredOption(
  field: FieldDef,
  option: StoredOption,
  stored: unknown[],
): void {
  if (field.options?.kind === "static" && option.custom !== true) {
    stored.push(option.value);
  } else {
    stored.push(option);
  }
}

function normalizeSelect(field: FieldDef, raw: unknown): NormalizeResult {
  const option = optionOf(raw);
  if (!option) {
    return typeIssue(field, "須為選項值");
  }
  const stored: unknown[] = [];
  pushStoredOption(field, option, stored);
  return { ok: true, value: stored[0] };
}

function normalizeMultiSelect(field: FieldDef, raw: unknown): NormalizeResult {
  if (!Array.isArray(raw)) {
    return typeIssue(field, "須為選項值清單");
  }
  const stored: unknown[] = [];
  for (const item of raw) {
    const option = optionOf(item);
    if (!option) {
      return typeIssue(field, "須為選項值清單");
    }
    pushStoredOption(field, option, stored);
  }
  return { ok: true, value: stored };
}

function normalizeUpload(field: FieldDef, raw: unknown): NormalizeResult {
  if (
    isRecord(raw) &&
    typeof raw.path === "string" &&
    typeof raw.name === "string" &&
    typeof raw.size === "number" &&
    Number.isInteger(raw.size) &&
    raw.size >= 0 &&
    typeof raw.contentType === "string"
  ) {
    const upload: StoredUpload = {
      path: raw.path,
      name: raw.name,
      size: raw.size,
      contentType: raw.contentType,
    };
    return { ok: true, value: upload };
  }
  return typeIssue(field, "須為上傳完成的檔案");
}

function normalizeReference(field: FieldDef, raw: unknown): NormalizeResult {
  let reference: StoredReference | null = null;
  if (typeof raw === "string") {
    reference = { id: raw, label: null };
  } else if (isRecord(raw) && typeof raw.id === "string") {
    reference = {
      id: raw.id,
      label: typeof raw.label === "string" ? raw.label : null,
    };
  }
  return reference
    ? { ok: true, value: reference }
    : typeIssue(field, "須為引用的來源");
}

function normalizeNumber(field: FieldDef, raw: unknown): NormalizeResult {
  const isNumeric =
    (typeof raw === "number" && Number.isFinite(raw)) ||
    (typeof raw === "string" && NUMERIC_STRING.test(raw));
  return isNumeric
    ? { ok: true, value: roundToPrecision(raw, field.precision ?? 0) }
    : typeIssue(field, "須為數字");
}

type Normalizer = (field: FieldDef, raw: unknown) => NormalizeResult;

/** 型別 → 正規化(空值已先處理掉)。 */
const NORMALIZERS: Readonly<Record<FieldType, Normalizer>> = {
  text: (field, raw) =>
    typeof raw === "string"
      ? { ok: true, value: raw }
      : typeIssue(field, "須為文字"),
  multiline: (field, raw) =>
    typeof raw === "string"
      ? { ok: true, value: raw }
      : typeIssue(field, "須為文字"),
  number: normalizeNumber,
  date: (field, raw) =>
    isCalendarDate(raw)
      ? { ok: true, value: raw }
      : typeIssue(field, "須為 YYYY-MM-DD 日期"),
  boolean: (field, raw) =>
    typeof raw === "boolean"
      ? { ok: true, value: raw }
      : typeIssue(field, "須為是 / 否"),
  select: normalizeSelect,
  multiSelect: normalizeMultiSelect,
  upload: normalizeUpload,
  reference: normalizeReference,
};

/**
 * 型別層的正規化:送來的值 → 存值形狀(`Spec §5「值的存法」`)。空值一律收成 `null`。
 * number 取到 `precision` 位的十進位字串;date 必須是 `YYYY-MM-DD`;其餘見各型別。
 */
export function normalizeFieldValue(
  field: FieldDef,
  raw: unknown,
): NormalizeResult {
  if (isEmptyValue(raw)) {
    return { ok: true, value: null };
  }
  const normalizer = (NORMALIZERS as Partial<Record<string, Normalizer>>)[
    field.type
  ];
  return normalizer
    ? normalizer(field, raw)
    : typeIssue(field, "未知的欄位型別");
}

/** 規則驗證要的上下文:`rules.custom` 求值用(語意值 + ctx + 定義與存值給 `optionLabel`)。 */
export interface RuleEvaluationInput {
  semantic: Record<string, unknown>;
  ctx: ExpressionContext;
  fields: readonly FieldDef[];
  stored: StoredValues;
}

const WHITESPACE = /\s/u;
const PHONE_PATTERN = /^\+?[\d\s()-]{6,20}$/u;

/** Email:恰一個 `@`、兩邊非空、網域有 `.` 且不在頭尾、全段無空白(不用回溯型的正則)。 */
function isEmail(value: string): boolean {
  const parts = value.split("@");
  if (parts.length !== 2 || WHITESPACE.test(value)) {
    return false;
  }
  const [local = "", domain = ""] = parts;
  const dot = domain.indexOf(".");
  return local !== "" && dot > 0 && !domain.endsWith(".");
}

function matchesFormat(format: string, value: string): boolean {
  switch (format) {
    case "email": {
      return isEmail(value);
    }
    case "phone": {
      return (
        PHONE_PATTERN.test(value) && value.replaceAll(/\D/gu, "").length >= 6
      );
    }
    case "url": {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }
    default: {
      return true;
    }
  }
}

function issueOf(
  field: FieldDef,
  code: ValueIssueCode,
  message: string,
): ValueIssue {
  return { fieldKey: field.key, code, message };
}

/** number / date 的範圍;回第一個違反的規則,沒有回 null。 */
function rangeIssue(field: FieldDef, value: unknown): ValueIssue | null {
  const rules = field.rules ?? {};
  if (field.type === "number") {
    const decimal = toDecimal(value);
    const min = toDecimal(rules.min);
    const max = toDecimal(rules.max);
    if (decimal && min && decimal.lessThan(min)) {
      return issueOf(
        field,
        "MIN",
        `「${field.label}」不可小於 ${String(rules.min)}`,
      );
    }
    if (decimal && max && decimal.greaterThan(max)) {
      return issueOf(
        field,
        "MAX",
        `「${field.label}」不可大於 ${String(rules.max)}`,
      );
    }
  }
  if (field.type === "date" && typeof value === "string") {
    if (typeof rules.min === "string" && value < rules.min) {
      return issueOf(field, "MIN", `「${field.label}」不可早於 ${rules.min}`);
    }
    if (typeof rules.max === "string" && value > rules.max) {
      return issueOf(field, "MAX", `「${field.label}」不可晚於 ${rules.max}`);
    }
  }
  return null;
}

/** text / multiline 的長度、正則、內建格式。 */
function textIssue(field: FieldDef, value: unknown): ValueIssue | null {
  if (typeof value !== "string") {
    return null;
  }
  const rules = field.rules ?? {};
  // 以 code point 計字數(中文、emoji 都算一個字),不用 UTF-16 的 `.length`
  const length = value.match(/./gsu)?.length ?? 0;
  if (rules.minLength !== undefined && length < rules.minLength) {
    return issueOf(
      field,
      "MIN_LENGTH",
      `「${field.label}」至少 ${String(rules.minLength)} 字`,
    );
  }
  if (rules.maxLength !== undefined && length > rules.maxLength) {
    return issueOf(
      field,
      "MAX_LENGTH",
      `「${field.label}」最多 ${String(rules.maxLength)} 字`,
    );
  }
  if (rules.pattern) {
    let matched = false;
    try {
      matched = new RegExp(rules.pattern, PATTERN_FLAGS).test(value);
    } catch {
      // 不合法的正則在發布前就被檢查器擋下;走到這裡一律當不符合
      matched = false;
    }
    if (!matched) {
      return issueOf(
        field,
        "PATTERN",
        rules.patternMessage ?? `「${field.label}」格式不符`,
      );
    }
  }
  if (rules.format && !matchesFormat(rules.format, value)) {
    return issueOf(
      field,
      "FORMAT",
      `「${field.label}」格式不符(${rules.format})`,
    );
  }
  return null;
}

/**
 * 完成資料所需的驗證(Spec §5 表的最右欄):必填、範圍、長度、正則 / 格式、`rules.custom`。
 * `value` 是**已正規化**的存值;計算欄位算成 null 且必填 → `NOT_COMPUTABLE`(「X 無法計算」)。
 * 回第一個違反的規則;全過回 null。
 */
export function validateFieldRules(
  field: FieldDef,
  value: unknown,
  input: RuleEvaluationInput,
): ValueIssue | null {
  const rules = field.rules ?? {};
  if (isEmptyValue(value)) {
    if (rules.required) {
      return field.valueSource.kind === "computed"
        ? issueOf(field, "NOT_COMPUTABLE", `「${field.label}」無法計算`)
        : issueOf(field, "REQUIRED", `「${field.label}」為必填`);
    }
  } else {
    const issue = rangeIssue(field, value) ?? textIssue(field, value);
    if (issue) {
      return issue;
    }
  }
  if (rules.custom !== undefined && rules.custom !== null) {
    let passed = false;
    try {
      passed = evaluateCondition(rules.custom, {
        values: input.semantic,
        ctx: input.ctx,
        fields: input.fields,
        stored: input.stored,
      });
    } catch {
      passed = false;
    }
    if (!passed) {
      return issueOf(field, "CUSTOM", `「${field.label}」不符合規則`);
    }
  }
  return null;
}
