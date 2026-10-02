import type { ModulePageReplacement } from "../../app/module-page-registry";
import { ProjectDesignerPage } from "./project-designer-page";
import { ProjectRolePage } from "./project-role-page";

/**
 * `app/project/page-replacements.ts` 的測試專案版:替換兩個底座治理頁。
 * 兩筆都沒寫 `minWidth` —— 角色管理沿用殼層預設、表單管理沿用底座宣告的 `xl`。
 * 模組 key 寫字面值:測試支援檔不 import 底座頁的內部(專案的寫法也應如此)。
 */
export const projectPageReplacements: readonly ModulePageReplacement[] = [
  { target: "system.role-manager", Page: ProjectRolePage },
  { target: "system.forms", Page: ProjectDesignerPage },
];
