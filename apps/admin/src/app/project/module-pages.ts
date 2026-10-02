import type { ModulePageSource } from "../module-page-registry";

/**
 * 專案的模組頁面來源:專案自己新增的模組在此登記(頁面放 `pages/project/`),底座更新不會動到這份。
 *
 * - 固定頁寫進 `pages`;表單模組寫進 `forms`(四頁用表單引擎的預設組裝,單頁客製用 `pageOverrides`)
 * - key 不可與底座或彼此相撞;要換掉底座的頁不是在這裡撞 key,而是寫進 `page-replacements.ts`
 * - 登記不等於授權:進不進得去仍看 `me.modules`
 */
export const projectModulePages: ModulePageSource = {
  pages: [],
  forms: [],
};
