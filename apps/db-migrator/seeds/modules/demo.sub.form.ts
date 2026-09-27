import { formModuleDeclaration } from "../form-module-declaration";
import { DEMO_SUB_GROUP_KEY } from "./demo.sub.sample-one";

export const DEMO_SUB_GROUP_FORM_KEY = `${DEMO_SUB_GROUP_KEY}.form`;

/**
 * 示範表單(次群組內):表單模組掛在次群組底下的示範(正本:docs/modules/demo-form.md)。
 * `demo.sub` 次群組由 demo.sub.sample-one.ts 宣告。seed 只開骨架;表單、流程與綁定由根組織在畫面上建。
 */
export const demoSubGroupFormModule = formModuleDeclaration({
  key: DEMO_SUB_GROUP_FORM_KEY,
  name: "示範表單(次群組內)",
  parentKey: DEMO_SUB_GROUP_KEY,
  order: 2,
  route: "form",
  icon: "description",
  description: "表單模組示範(次群組內):欄位由表單設計,資料存 form_submissions",
});
