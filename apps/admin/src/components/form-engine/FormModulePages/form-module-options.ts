import { DEFAULT_TAB_LABEL_TEMPLATE } from "@/lib/form-engine/tab-label";

/**
 * 表單模組的**模組層**設定(`formModulePages(moduleKey, options)` 登記時給)。
 * 目前只有頁籤 / 標題模板:套摘要槽,表單自己的 `tabLabelTemplate` 可覆寫(Spec 6a §8「其他」)。
 */
export interface FormModuleOptions {
  tabLabelTemplate?: string;
}

/** 模組 key → 設定;只在模組載入時(`module-pages.tsx` 呼叫 `formModulePages`)寫入,render 期間只讀。 */
const registered = new Map<string, Required<FormModuleOptions>>();

export const registerFormModule = (
  moduleKey: string,
  options: FormModuleOptions,
): void => {
  registered.set(moduleKey, {
    tabLabelTemplate: options.tabLabelTemplate ?? DEFAULT_TAB_LABEL_TEMPLATE,
  });
};

export const formModuleOptionsOf = (
  moduleKey: string,
): Required<FormModuleOptions> =>
  registered.get(moduleKey) ?? { tabLabelTemplate: DEFAULT_TAB_LABEL_TEMPLATE };
