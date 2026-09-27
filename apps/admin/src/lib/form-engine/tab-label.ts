/**
 * 頁籤 / 標題模板(Spec 6a §8「其他」):模組層模板套摘要槽,表單的 `tabLabelTemplate` 可覆寫。
 * 模板只能引用摘要槽(`{{title}}`、`{{date}}`、`{{amount}}`);沒值的槽換成空字串,整串是空的回 null
 * (呼叫端退回顯示模組名)。
 */

/** 模組層的預設模板:`formModulePages(moduleKey, { tabLabelTemplate })` 沒給時用它。 */
export const DEFAULT_TAB_LABEL_TEMPLATE = "{{title}}";

export interface SummaryLike {
  title?: string | null;
  date?: string | null;
  amount?: string | null;
}

const SLOT_PATTERN = /\{\{\s*(title|date|amount)\s*\}\}/g;

export const applyTabLabelTemplate = (
  template: string,
  summary: SummaryLike | null | undefined,
): string | null => {
  const label = template
    .replaceAll(SLOT_PATTERN, (_match, slot: "title" | "date" | "amount") => {
      const value = summary?.[slot];
      return typeof value === "string" ? value : "";
    })
    .trim();
  return label === "" ? null : label;
};

/** 表單有自己的模板就用它,否則用模組層的。 */
export const tabLabelOf = (
  moduleTemplate: string,
  formTemplate: string | null | undefined,
  summary: SummaryLike | null | undefined,
): string | null =>
  applyTabLabelTemplate(
    formTemplate !== null && formTemplate !== undefined && formTemplate !== ""
      ? formTemplate
      : moduleTemplate,
    summary,
  );
