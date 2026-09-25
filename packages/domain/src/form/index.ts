/**
 * `@repo/domain/form` 的出口檔(bunchee 由 `exports` 名反推本檔;GEN-01 的 packages 邊界例外)。
 * 表單引擎的純邏輯(Spec 6a §1、§4、§5),前後端共用:
 *
 * - `types.ts`:FieldDef / Layout / SummaryMap / Prefill / lookup 來源描述 / 表達式與上下文
 * - `keys.ts`:表單 key、欄位 key(含保留字)、租戶短碼的格式(不依賴外部套件)
 * - `semantic.ts`:存值 → 語意值(表達式 `var` 看到的)與選項顯示名
 * - `expression-shape.ts` / `expression.ts`:表達式白名單與上限、JSONLogic + decimal 計算器
 * - `compute.ts` / `dependencies.ts`:計算欄位求值(拓樸順序、最終取位)、受保護依賴鏈
 * - `layout.ts`、`summary.ts`:版面換算、摘要槽快照
 * - `validate-*.ts`、`issues.ts`、`registry.ts`:定義檢查器與它的登錄表
 * - `values.ts`:提交值的型別正規化與規則驗證(存草稿只驗型別、送出再驗規則)
 */
export * from "./compute";
export * from "./dependencies";
export * from "./expression";
export * from "./expression-shape";
export * from "./issues";
export * from "./keys";
export * from "./layout";
export * from "./registry";
export * from "./semantic";
export * from "./summary";
export * from "./types";
export * from "./validate-definition";
export * from "./values";
export {
  FORM_SUBMISSION_PROVIDER,
  PATTERN_FLAGS,
  type RegexSafetyCheck,
} from "./validate-fields";
