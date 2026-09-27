/**
 * 頁籤 / 標題模板(Spec 6a §8「其他」):模組層模板套摘要槽,表單的 `tabLabelTemplate` 可覆寫。
 * 模板能用的佔位符:摘要槽 `{{title}}`、`{{date}}`、`{{amount}}`,以及系統佔位符 `{{applicant}}`(建立者現名)、
 * `{{form}}`(表單名)。沒值的換成空字串,整串是空的回 null(呼叫端退回顯示模組名)。
 */

/** 模組層的預設模板:`formModulePages(moduleKey, { tabLabelTemplate })` 沒給時用它。 */
export const DEFAULT_TAB_LABEL_TEMPLATE = "{{title}}";

/** 模板可用的佔位符(依設定畫面列出的順序)。 */
export const TAB_LABEL_PLACEHOLDERS = [
  "title",
  "date",
  "amount",
  "applicant",
  "form",
] as const;

export type TabLabelPlaceholder = (typeof TAB_LABEL_PLACEHOLDERS)[number];

/** 套模板用的值:摘要槽 + 建立者現名 + 表單名。 */
export type TabLabelValues = Partial<
  Record<TabLabelPlaceholder, string | null>
>;

/** 摘要(`submission.summary`)的形狀;與建立者、表單名合成 `TabLabelValues`。 */
export interface SummaryLike {
  title?: string | null;
  date?: string | null;
  amount?: string | null;
}

const SLOT_PATTERN = /\{\{\s*(title|date|amount|applicant|form)\s*\}\}/g;

export const applyTabLabelTemplate = (
  template: string,
  values: TabLabelValues | null | undefined,
): string | null => {
  const label = template
    .replaceAll(SLOT_PATTERN, (_match, slot: TabLabelPlaceholder) => {
      const value = values?.[slot];
      return typeof value === "string" ? value : "";
    })
    .trim();
  return label === "" ? null : label;
};

/** 一筆提交的模板值:摘要 + 建立者現名(`createdBy.name`)+ 表單名(`formName`)。 */
export const tabLabelValuesOf = (submission: {
  summary?: SummaryLike | null;
  createdBy?: { name?: string | null } | null;
  formName?: string | null;
}): TabLabelValues => ({
  ...submission.summary,
  applicant: submission.createdBy?.name ?? null,
  form: submission.formName ?? null,
});

/** 表單有自己的模板就用它,否則用模組層的。 */
export const tabLabelOf = (
  moduleTemplate: string,
  formTemplate: string | null | undefined,
  values: TabLabelValues | null | undefined,
): string | null =>
  applyTabLabelTemplate(
    formTemplate !== null && formTemplate !== undefined && formTemplate !== ""
      ? formTemplate
      : moduleTemplate,
    values,
  );
