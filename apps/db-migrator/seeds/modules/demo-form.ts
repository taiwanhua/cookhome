import { formModuleDeclaration } from "../form-module-declaration";

export const DEMO_FORM_KEY = "demo-form";

/**
 * 示範表單(頂層):表單模組掛在側欄頂層的示範(正本:docs/modules/forms.md「示範表單模組」)。
 * seed 只開骨架;表單、流程與綁定由根組織在畫面上建。
 */
export const demoFormModule = formModuleDeclaration({
  key: DEMO_FORM_KEY,
  name: "示範表單(頂層)",
  parentKey: null,
  order: 3,
  route: "demo-form",
  icon: "description",
  description: "表單模組示範(頂層):欄位由表單設計,資料存 form_submissions",
});
