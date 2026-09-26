import { useTranslations } from "use-intl";

import type { FormDefinition, StoredValues } from "@repo/domain/form";

import { useMe } from "@/hooks/useMe";
import { useModuleForms } from "@/hooks/useModuleForms";
import { useTenantTimezone } from "@/hooks/useTenantTimezone";
import {
  type TabLabelAction,
  renderTabLabel,
  tabLabelTemplateOf,
} from "@/lib/form-engine/tab-label";

import { formModuleOptionsOf } from "./form-module-options";

export interface TabLabelSubject {
  /** 表單模組的 key(不是隱藏頁的 key) */
  moduleKey: string;
  /** 模組名;沒給就從 `me.modules` 找(讀者沒有該模組時由呼叫端給,例:申請中心用實例上的名稱) */
  moduleName?: string | null;
  formKey: string | null | undefined;
  formName: string | null | undefined;
  /** 那一筆綁的版本定義(還沒載到為 null) */
  definition: Pick<FormDefinition, "fields" | "summaryMap"> | null;
  action: TabLabelAction;
  applicantName?: string | null;
  /** 唯讀歷史 = 該修訂的 `ctx.timezone`;沒給 = 讀者的租戶時區 */
  timezone?: string | null;
  /** `{{date}}` 沒對欄位時用的送出時間(草稿沒有) */
  submittedAt?: string | null;
}

export interface TabLabelRenderOptions {
  /** false = 不加 `{{action}}`(刪除確認這類引用「這一筆」的文字) */
  withAction?: boolean;
}

/**
 * 頁籤 / 標題的算法(`lib/form-engine/tab-label.ts` 的 `renderTabLabel`)綁好這一筆的脈絡,回 `(values) => 標題`:
 * 模板 = 表單的 `tabLabelTemplate`(`moduleForms` 讀得到時)→ 模組層模板;`{{action}}` 的文字與是 / 否從字典取。
 * 詳情頁直接以存值呼叫;新增 / 編輯頁交給 `FormFillForm` 以正在輸入的值呼叫。
 */
export const useTabLabelRenderer = (
  subject: TabLabelSubject,
): ((
  values: StoredValues | null | undefined,
  options?: TabLabelRenderOptions,
) => string | null) => {
  const t = useTranslations("admin.formEngine.pages.actions");
  const tValue = useTranslations("admin.formEngine.renderer");
  const tenantTimezone = useTenantTimezone();
  const me = useMe();
  const { forms } = useModuleForms(subject.moduleKey);
  const template = tabLabelTemplateOf(
    formModuleOptionsOf(subject.moduleKey).tabLabelTemplate,
    forms.find((form) => form.key === subject.formKey)?.tabLabelTemplate,
  );
  const moduleName =
    subject.moduleName ??
    me.data?.me.modules.find((module) => module.key === subject.moduleKey)
      ?.name ??
    null;
  const action = t(subject.action);
  const booleanText = { yes: tValue("yes"), no: tValue("no") };

  return (values, options) =>
    renderTabLabel(template, {
      values,
      definition: subject.definition,
      formName: subject.formName ?? subject.formKey ?? null,
      moduleName,
      applicantName: subject.applicantName,
      action: options?.withAction === false ? "" : action,
      timezone: subject.timezone ?? tenantTimezone,
      submittedAt: subject.submittedAt,
      booleanText,
    });
};
