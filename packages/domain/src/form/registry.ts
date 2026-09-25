import type { FieldType } from "./types";

/**
 * 檢查器要的登錄表(Spec §5):widget、lookup 來源、欄位管理類別。
 * domain 只給 widget 的預設登錄表;lookup provider(api 的 `lookup-providers.ts`)與類別 key(資料庫)
 * 由呼叫端注入,沒注入就跳過那一項檢查。
 */

/** `type` → 可用的 `widget.kind`。擴充 widget = 這裡加一筆 + admin 元件登錄表加一筆。 */
export type WidgetRegistry = Readonly<Record<FieldType, readonly string[]>>;

export const DEFAULT_WIDGET_REGISTRY: WidgetRegistry = {
  text: ["textField"],
  multiline: ["textArea"],
  number: ["number"],
  date: ["datePicker"],
  select: ["dropdown", "radio", "autocomplete"],
  multiSelect: ["checkboxGroup", "multiDropdown", "autocompleteMulti"],
  boolean: ["switch", "checkbox"],
  upload: ["upload"],
  reference: ["referencePicker"],
};

/** 可開 `rules.allowCustom`(= freeSolo)的 widget。 */
export const ALLOW_CUSTOM_WIDGETS: readonly string[] = [
  "autocomplete",
  "autocompleteMulti",
];

/** 一個 lookup 來源可回的欄位與各欄位的型別(帶入時驗型別相容用)。 */
export interface LookupProviderSpec {
  fields: Readonly<Record<string, FieldType>>;
}

export type LookupProviderRegistry = Readonly<
  Record<string, LookupProviderSpec>
>;
