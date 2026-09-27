/**
 * 排序字串用的語系(STRUCT-10:`localeCompare` 一律明給 `zh-Hant`,不留給執行環境決定)。
 * 只用在「讓輸出順序穩定」的地方(依賴鏈、循環的簽章);表達式的 `<` / `>` 是字碼比較,不用它。
 */
export const COLLATION_LOCALE = "zh-Hant";
