/**
 * 表單定義的型別(`form_versions` 一版的內容;語意正本見 Spec 6a §4、§5 與 `docs/data-model.md`)。
 * 純型別,前後端共用:api 存取與驗證、admin 設計器與渲染器都吃同一份。
 */

/** 欄位資料型別:決定**存什麼**(畫法由 `widget.kind` 決定;分區標題不是欄位,在 Layout 裡)。 */
export const FIELD_TYPES = [
  "text",
  "multiline",
  "number",
  "date",
  "select",
  "multiSelect",
  "boolean",
  "upload",
  "reference",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/** JSONLogic 樹(存 JSON;設計器用選單產生,不做文字輸入)。 */
export type Expression =
  | string
  | number
  | boolean
  | null
  | Expression[]
  | { [operator: string]: Expression };

/**
 * 表達式的上下文(`ctx.*`):草稿用真正的現在與填寫者;歷史檢視由 `revisions[r].ctx` 轉來,
 * 不拿讀者現在的身分或時間補值(Spec §5「歷史檢視的上下文」)。
 */
export interface ExpressionContext {
  /** ISO 8601 時間字串。 */
  now: string;
  /** IANA 時區(租戶時區),`dateDiff` 以它的日曆日計。 */
  timezone: string;
  user: { id: string | null; orgId: string | null };
}

/** lookup 來源描述(`options.source`、`prefills[].source`、`reference` 的 `source`)。 */
export interface LookupSourceDescriptor {
  /** 登錄表(`apps/api/src/forms/lookup-providers.ts`)的 key。 */
  provider: string;
  /** 顯示欄(必須在 provider 可回的欄位內)。 */
  labelField: string;
  /** 值欄,`options` 用;預設 `id`。 */
  valueField?: string;
  /** 固定條件(provider 允許的欄位 = 值),後端套。 */
  filter?: Record<string, unknown>;
  /** 只有 `provider = "form_submission"` 要:查哪張表單的提交。 */
  formKey?: string;
  /** `form_submission` 用,預設 true:只列已完成。 */
  completedOnly?: boolean;
}

export interface StaticOptionItem {
  value: string;
  label: string;
  order: number;
  enabled: boolean;
}

/** select / multiSelect 的選項,三種來源擇一。 */
export type FieldOptions =
  | { kind: "static"; items: StaticOptionItem[] }
  | { kind: "fieldCategory"; key: string }
  | { kind: "lookup"; source: LookupSourceDescriptor };

export type ValueSource =
  | { kind: "input" }
  | { kind: "computed"; expr: Expression }
  | { kind: "constant"; value: unknown };

/** 免寫正則的內建格式(與 `pattern` 二擇一)。 */
export const TEXT_FORMATS = ["email", "phone", "url"] as const;

export type TextFormat = (typeof TEXT_FORMATS)[number];

export interface FieldRules {
  required?: boolean;
  /** number:數值(decimal 字串或數字);date:`YYYY-MM-DD`。 */
  min?: number | string;
  max?: number | string;
  minLength?: number;
  maxLength?: number;
  /** JS `RegExp` 語法,固定 `u` flag,長度 ≤ 200,須搭 `patternMessage`。 */
  pattern?: string;
  patternMessage?: string;
  format?: TextFormat;
  /** 只有 `autocomplete` / `autocompleteMulti` 可開。 */
  allowCustom?: boolean;
  /** 表達式,回 false 即錯。 */
  custom?: Expression;
}

export interface FieldWidget {
  /** admin 元件登錄表的 key。 */
  kind: string;
  /** 只管長相的設定(`unit`、`placeholder`、`rows`…)。 */
  [setting: string]: unknown;
}

export interface FieldPermission {
  /** true = 受保護欄位,發布時建 `show-<formKey>-<fieldKey>`。 */
  show: boolean;
  /** true = 發布時建 `edit-<formKey>-<fieldKey>`。 */
  edit: boolean;
}

/** `form_versions.fields[]` 的一筆。 */
export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** 只有 number:小數位數 0–6。 */
  precision?: number;
  widget: FieldWidget;
  valueSource: ValueSource;
  options?: FieldOptions | null;
  rules?: FieldRules | null;
  visibleWhen?: Expression;
  readonlyWhen?: Expression;
  permission?: FieldPermission | null;
  help?: string | null;
  /** 只有 `reference`:lookup 來源描述。 */
  source?: LookupSourceDescriptor | null;
  /**
   * 只出現在執行端讀到的定義(`formRuntimeVersion`):讀者讀不到這一欄時為 true,
   * 此時只剩骨架(key / label / type / `widget.kind` / `valueSource.kind` / `permission`),
   * 內容(固定值、公式、選項、規則、說明)已省略。設計端的定義沒有這個欄位。
   */
  redacted?: boolean;
}

export interface LayoutCol {
  fieldKey: string;
  /** 12 格制,桌機的寬度。 */
  span: number;
}

export interface LayoutRow {
  cols: LayoutCol[];
}

export interface LayoutSection {
  key: string;
  title: string;
  rows: LayoutRow[];
}

export interface Layout {
  sections: LayoutSection[];
}

/** 摘要槽 → 欄位 key;`title` 必填,`date` 不對 = 用送出時間,`amount` 選填。 */
export interface SummaryMap {
  title?: string | null;
  date?: string | null;
  amount?: string | null;
}

export type SummarySlot = keyof SummaryMap;

export interface PrefillMapping {
  sourceField: string;
  fieldKey: string;
}

export interface Prefill {
  label: string;
  source: LookupSourceDescriptor;
  mapping: PrefillMapping[];
}

/** 一版表單定義(`form_versions` 裡檢查器與計算要的四塊)。 */
export interface FormDefinition {
  fields: FieldDef[];
  layout: Layout;
  summaryMap: SummaryMap;
  prefills: Prefill[];
}

/** `values` 的一格(存的值;形狀依型別,見 Spec §5「值的存法」)。 */
export type StoredValues = Record<string, unknown>;
