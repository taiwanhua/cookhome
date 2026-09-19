import { buildHelpRegistry } from "../lib/module-help";

/**
 * `lib/help-registry.ts` 的測試替身(jest `moduleNameMapper` 換掉,見 `jest.config.mjs`)。
 * 真的那份用 Vite 的 `import.meta.glob` 把 `src/md/module-help/*.help.md` 打包進 bundle —
 * jest 沒有這個編譯期轉換,所以測試改用這份假的檔案表,介面(`moduleHelpMarkdown`)一模一樣。
 *
 * 預設值刻意只有幾個模組、內容也不是正本(正本是 md 檔,會一直改;測試不該跟著改),
 * 但形狀照 help.md 的慣例:`# 模組名` + `## 小節` + 清單。
 */
const DEFAULT_HELP_FILES: Record<string, string> = {
  "/src/md/module-help/overview.help.md": [
    "# 總覽",
    "",
    "## 這個模組做什麼",
    "",
    "一眼看到目前組織的重點。",
  ].join("\n"),
  "/src/md/module-help/system.org-manager.help.md": [
    "# 組織管理",
    "",
    "## 這個模組做什麼",
    "",
    "維護組織樹:新增下層組織、編輯資料、停用或刪除。",
    "",
    "## 常用操作",
    "",
    "- **開通租戶**:建立一個新的頂層組織。",
    "- **編輯組織**:改名稱、描述、商標。",
  ].join("\n"),
  "/src/md/module-help/system.role-manager.help.md": [
    "# 角色管理",
    "",
    "## 這個模組做什麼",
    "",
    "角色是一組權限的集合。",
    "",
    "## 常用操作",
    "",
    "- **建立角色**:選擇所屬組織、名稱與描述。",
    "- **分配使用者**:只能選該組織或其下層組織的人。",
  ].join("\n"),
};

let registry = buildHelpRegistry(DEFAULT_HELP_FILES);

/** 換一份假的檔案表(測「這個模組沒有 help.md」之類的情境);`setup.ts` 每個測試後歸零。 */
export const setHelpFiles = (files: Readonly<Record<string, string>>): void => {
  registry = buildHelpRegistry(files);
};

/** 回到預設的假檔案表。 */
export const resetHelpFiles = (): void => {
  registry = buildHelpRegistry(DEFAULT_HELP_FILES);
};

/** 與 `lib/help-registry.ts` 同名同形的查詢函式。 */
export const moduleHelpMarkdown = (moduleKey: string): string | undefined =>
  registry.get(moduleKey);
