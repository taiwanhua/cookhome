import type { FieldDef } from "@repo/domain/form";

/**
 * 屬性面板每種型別該出現哪些設定(Spec 6a §5「欄位屬性面板:每種型別的設定(表 A)」)。
 * 純函式,面板照它開關各區塊;規則改了只改這一張。
 */
export interface PropertySections {
  /** 元件下拉:該型別有兩種以上畫法才出現(單選 / 多選 / 是否) */
  widget: boolean;
  /** 元件設定:多行文字的列數 */
  widgetRows: boolean;
  /** 元件設定:數字的單位 */
  widgetUnit: boolean;
  /** 值來源(使用者填 / 公式 / 固定值);上傳只能使用者填、引用只能使用者選,不顯示 */
  valueSource: boolean;
  /** 預設值(值來源 = 使用者填才有;上傳沒有)—— 編輯器由預設值的票提供,這裡先定位置 */
  defaultValue: boolean;
  /** 選項來源(靜態 / 類別 / lookup) */
  options: boolean;
  /** 引用欄位的資料來源(必填) */
  referenceSource: boolean;
  lengthRange: boolean;
  numberRange: boolean;
  dateRange: boolean;
  /** 內建格式或正則 + 訊息(只有單行文字) */
  textFormat: boolean;
  /** 允許清單外的值(只有可搜尋 / 可搜尋多選,且值來源 = 使用者填) */
  allowCustom: boolean;
  /** 自訂驗證 + 錯誤訊息(是否、上傳沒有) */
  custom: boolean;
  /** 鎖定條件(值來源 = 使用者填才有) */
  readonlyWhen: boolean;
}

/** 值來源固定、不給選的型別。 */
const FIXED_SOURCE_TYPES = new Set<FieldDef["type"]>(["upload", "reference"]);

export const propertySectionsOf = (
  field: FieldDef,
  widgetKinds: readonly string[],
  allowCustomWidgets: readonly string[],
): PropertySections => {
  const { type } = field;
  const isInput = field.valueSource.kind === "input";
  const isChoice = type === "select" || type === "multiSelect";
  return {
    widget: widgetKinds.length > 1,
    widgetRows: type === "multiline",
    widgetUnit: type === "number",
    valueSource: !FIXED_SOURCE_TYPES.has(type),
    defaultValue: isInput && type !== "upload",
    options: isChoice,
    referenceSource: type === "reference",
    lengthRange: type === "text" || type === "multiline",
    numberRange: type === "number",
    dateRange: type === "date",
    textFormat: type === "text",
    allowCustom:
      isInput && isChoice && allowCustomWidgets.includes(field.widget.kind),
    custom: type !== "boolean" && type !== "upload",
    readonlyWhen: isInput,
  };
};
