import { checkSync } from "recheck";

import type { IssueCollector } from "./issues";
import { checkFieldKey } from "./keys";
import {
  ALLOW_CUSTOM_WIDGETS,
  type LookupProviderRegistry,
  type WidgetRegistry,
} from "./registry";
import {
  FIELD_TYPES,
  type FieldDef,
  type FieldType,
  type LookupSourceDescriptor,
} from "./types";

/**
 * 檢查器的欄位段(Spec §5「定義檢查器」):key、精度、widget、選項、規則(含正則 ReDoS)、reference。
 */

/** 正則長度上限。 */
export const MAX_PATTERN_LENGTH = 200;

/** 正則固定用的 flag(前後端同一顆引擎,結果一致)。 */
export const PATTERN_FLAGS = "u";

/** 正則是否安全(不會被特定輸入卡住);預設用 `recheck`。 */
export type RegexSafetyCheck = (source: string) => boolean;

/** recheck 在 node 端選同步後端的環境變數(它只認這個,沒有程式內參數)。 */
const RECHECK_SYNC_BACKEND = "RECHECK_SYNC_BACKEND";

/**
 * 以 recheck 的**純 JS 後端**同步執行 `fn`。
 *
 * recheck 在 node 的 `checkSync` 預設走 synckit:另開 worker、優先 spawn 原生執行檔或 java,
 * 主執行緒以 `Atomics.wait` 等結果 —— api 每檢查一條正則就可能卡住最多一個逾時。
 * 同步後端只能用環境變數 `RECHECK_SYNC_BACKEND` 選(`lib/main.js` 每次呼叫時讀),
 * 所以在呼叫前暫時設成 `pure`、呼叫後還原,不影響行程裡其他人的設定。
 * 瀏覽器版(`lib/browser.js`)本來就只有純 JS,沒有 `process` 時直接呼叫。
 */
function withPureRecheck<T>(fn: () => T): T {
  if (typeof process === "undefined") {
    return fn();
  }
  const previous = process.env[RECHECK_SYNC_BACKEND];
  process.env[RECHECK_SYNC_BACKEND] = "pure";
  try {
    return fn();
  } finally {
    if (previous === undefined) {
      Reflect.deleteProperty(process.env, RECHECK_SYNC_BACKEND);
    } else {
      process.env[RECHECK_SYNC_BACKEND] = previous;
    }
  }
}

/**
 * 預設的 ReDoS 檢查:`recheck`(固定純 JS 後端,見 `withPureRecheck`)判定為 `safe` 才算安全;
 * `vulnerable` 與「判不出來」(`unknown`,含逾時)都視為不安全 — 寧可請設計者改寫,也不讓 API 冒險。
 */
export const recheckRegexSafety: RegexSafetyCheck = (source) =>
  withPureRecheck(
    () => checkSync(source, PATTERN_FLAGS, { timeout: 2000 }).status,
  ) === "safe";

export interface FieldValidationContext {
  widgets: WidgetRegistry;
  regexSafety: RegexSafetyCheck;
  previousFields?: readonly FieldDef[];
  fieldCategoryKeys?: ReadonlySet<string>;
  lookupProviders?: LookupProviderRegistry;
}

export function validateFields(
  fields: readonly FieldDef[],
  context: FieldValidationContext,
  collector: IssueCollector,
): void {
  const seen = new Set<string>();
  const previousTypes = new Map(
    (context.previousFields ?? []).map((field) => [field.key, field.type]),
  );
  for (const field of fields) {
    const location = { fieldKey: field.key };
    if (seen.has(field.key)) {
      collector.error("KEY_DUPLICATE", `欄位 key ${field.key} 重複`, location);
    }
    seen.add(field.key);
    validateKeyFormat(field, collector);
    // 型別不在 `FIELD_TYPES` 內:後面每一項都以型別查表,這個欄位不再往下檢查
    if (!hasKnownType(field, collector)) {
      continue;
    }
    const previousType = previousTypes.get(field.key);
    if (previousType !== undefined && previousType !== field.type) {
      collector.error(
        "KEY_TYPE_CHANGED",
        `欄位 ${field.key} 在已發布版本是 ${previousType},發布後不可改型別`,
        location,
      );
    }
    validatePrecision(field, collector);
    validateWidget(field, context.widgets, collector);
    validateOptions(field, context, collector);
    validateRules(field, context.regexSafety, collector);
    validateReference(field, context.lookupProviders, collector);
  }
}

/** 欄位 key 的格式與保留字(`keys.ts`)。 */
function validateKeyFormat(field: FieldDef, collector: IssueCollector): void {
  const keyCheck = checkFieldKey(field.key);
  if (keyCheck.valid) {
    return;
  }
  collector.error(
    keyCheck.reason === "reserved" ? "KEY_RESERVED" : "KEY_FORMAT",
    keyCheck.reason === "reserved"
      ? `欄位 key ${field.key} 是保留字`
      : `欄位 key ${field.key} 格式不符(小寫開頭,只允許小寫、數字、底線,最長 40)`,
    { fieldKey: field.key },
  );
}

/** 型別在 `FIELD_TYPES` 內;不在就報 `FIELD_TYPE_UNKNOWN`(定義來自設計器送來的 JSON,型別保證不了)。 */
function hasKnownType(field: FieldDef, collector: IssueCollector): boolean {
  if ((FIELD_TYPES as readonly string[]).includes(field.type)) {
    return true;
  }
  collector.error(
    "FIELD_TYPE_UNKNOWN",
    `「${field.label}」的型別 ${field.type} 不存在`,
    { fieldKey: field.key, property: "type" },
  );
  return false;
}

function validatePrecision(field: FieldDef, collector: IssueCollector): void {
  if (field.type !== "number" || field.precision === undefined) {
    return;
  }
  if (
    !Number.isInteger(field.precision) ||
    field.precision < 0 ||
    field.precision > 6
  ) {
    collector.error(
      "PRECISION_INVALID",
      `「${field.label}」的小數位數須為 0–6`,
      {
        fieldKey: field.key,
        property: "precision",
      },
    );
  }
}

function validateWidget(
  field: FieldDef,
  widgets: WidgetRegistry,
  collector: IssueCollector,
): void {
  const kind = field.widget.kind;
  const location = { fieldKey: field.key, property: "widget.kind" };
  const isRegistered = Object.values(widgets).some((kinds) =>
    kinds.includes(kind),
  );
  if (!isRegistered) {
    collector.error(
      "WIDGET_UNKNOWN",
      `「${field.label}」的元件 ${kind} 未登記`,
      location,
    );
    return;
  }
  if (!widgets[field.type].includes(kind)) {
    collector.error(
      "WIDGET_TYPE_MISMATCH",
      `「${field.label}」的元件 ${kind} 不能用在 ${field.type} 型別`,
      location,
    );
  }
}

function validateOptions(
  field: FieldDef,
  context: FieldValidationContext,
  collector: IssueCollector,
): void {
  const isChoice = field.type === "select" || field.type === "multiSelect";
  if (
    field.rules?.allowCustom === true &&
    !ALLOW_CUSTOM_WIDGETS.includes(field.widget.kind)
  ) {
    collector.error(
      "ALLOW_CUSTOM_WIDGET",
      `「${field.label}」只有 autocomplete 類元件可允許自訂值`,
      { fieldKey: field.key, property: "rules.allowCustom" },
    );
  }
  if (!isChoice) {
    return;
  }
  const options = field.options;
  if (!options) {
    collector.error("OPTIONS_MISSING", `「${field.label}」沒有設定選項來源`, {
      fieldKey: field.key,
      property: "options",
    });
    return;
  }
  switch (options.kind) {
    case "static": {
      const values = new Set<string>();
      for (const [index, item] of options.items.entries()) {
        if (values.has(item.value)) {
          collector.error(
            "OPTIONS_DUPLICATE_VALUE",
            `「${field.label}」的選項值 ${item.value} 重複`,
            {
              fieldKey: field.key,
              property: `options.items.${String(index)}.value`,
            },
          );
        }
        values.add(item.value);
      }
      return;
    }
    case "fieldCategory": {
      if (
        context.fieldCategoryKeys &&
        !context.fieldCategoryKeys.has(options.key)
      ) {
        collector.error(
          "OPTIONS_UNKNOWN_CATEGORY",
          `「${field.label}」的欄位管理類別 ${options.key} 不存在`,
          { fieldKey: field.key, property: "options.key" },
        );
      }
      return;
    }
    case "lookup": {
      validateLookupSource(options.source, context.lookupProviders, collector, {
        fieldKey: field.key,
        property: "options.source",
      });
      return;
    }
  }
}

/** 「其他表單提交」這個 lookup 來源的 key;它的來源描述必須帶 `formKey`。 */
export const FORM_SUBMISSION_PROVIDER = "form_submission";

/** lookup 來源描述:provider 已登錄、顯示欄 / 值欄在可回欄位內。沒注入登錄表就跳過。 */
export function validateLookupSource(
  source: LookupSourceDescriptor,
  providers: LookupProviderRegistry | undefined,
  collector: IssueCollector,
  location: { fieldKey?: string; prefillIndex?: number; property: string },
): void {
  if (!providers) {
    return;
  }
  const provider = providers[source.provider];
  if (!provider) {
    collector.error(
      "LOOKUP_UNKNOWN_PROVIDER",
      `lookup 來源 ${source.provider} 未登錄`,
      location,
    );
    return;
  }
  // `form_submission` 來源要指定查哪張表單的提交(Spec §5「lookup 來源」)
  if (
    source.provider === FORM_SUBMISSION_PROVIDER &&
    (source.formKey === undefined || source.formKey === "")
  ) {
    collector.error(
      "LOOKUP_FORM_KEY_MISSING",
      `lookup 來源 ${source.provider} 要指定 formKey(查哪張表單的提交)`,
      location,
    );
  }
  const fields = [source.labelField, source.valueField ?? "id"];
  for (const name of fields) {
    // 用 `Object.hasOwn`:`in` 會把 `toString` / `constructor` 這類原型鏈上的名稱當成欄位
    if (name !== "id" && !Object.hasOwn(provider.fields, name)) {
      collector.error(
        "LOOKUP_UNKNOWN_FIELD",
        `lookup 來源 ${source.provider} 沒有欄位 ${name}`,
        location,
      );
    }
  }
}

function validateRules(
  field: FieldDef,
  regexSafety: RegexSafetyCheck,
  collector: IssueCollector,
): void {
  const rules = field.rules;
  const pattern = rules?.pattern;
  if (pattern === undefined || pattern === "") {
    return;
  }
  const location = { fieldKey: field.key, property: "rules.pattern" };
  if (rules?.format !== undefined) {
    collector.error(
      "PATTERN_WITH_FORMAT",
      `「${field.label}」的正則與內建格式只能二擇一`,
      location,
    );
  }
  if (
    rules?.patternMessage === undefined ||
    rules.patternMessage.trim() === ""
  ) {
    collector.error(
      "PATTERN_MESSAGE_MISSING",
      `「${field.label}」設了正則,必須附錯誤提示文字`,
      { fieldKey: field.key, property: "rules.patternMessage" },
    );
  }
  if (pattern.length > MAX_PATTERN_LENGTH) {
    collector.error(
      "PATTERN_INVALID",
      `「${field.label}」的正則超過 ${String(MAX_PATTERN_LENGTH)} 字`,
      location,
    );
    return;
  }
  if (!compiles(pattern)) {
    collector.error(
      "PATTERN_INVALID",
      `「${field.label}」的正則語法不正確`,
      location,
    );
    return;
  }
  if (!regexSafety(pattern)) {
    collector.error(
      "PATTERN_UNSAFE",
      `「${field.label}」的正則可能造成效能問題,請改寫`,
      location,
    );
  }
}

/** 只為了驗語法;實際比對在 api / admin 以同樣的 flag 建。 */
function compiles(pattern: string): boolean {
  try {
    return new RegExp(pattern, PATTERN_FLAGS).source.length > 0;
  } catch {
    return false;
  }
}

function validateReference(
  field: FieldDef,
  providers: LookupProviderRegistry | undefined,
  collector: IssueCollector,
): void {
  if (field.type !== "reference") {
    return;
  }
  if (!field.source) {
    collector.error(
      "REFERENCE_SOURCE_MISSING",
      `引用欄位「${field.label}」沒有設定來源`,
      {
        fieldKey: field.key,
        property: "source",
      },
    );
    return;
  }
  validateLookupSource(field.source, providers, collector, {
    fieldKey: field.key,
    property: "source",
  });
}

/** 帶入的型別相容:同型別,或目標是文字類而來源可轉成文字。 */
export function isPrefillCompatible(
  source: FieldType,
  target: FieldType,
): boolean {
  if (source === target) {
    return true;
  }
  const textual: FieldType[] = ["text", "multiline"];
  const stringifiable: FieldType[] = [
    "text",
    "multiline",
    "number",
    "date",
    "select",
  ];
  return textual.includes(target) && stringifiable.includes(source);
}
