import { buildHelpRegistry } from "./module-help";

/**
 * 打包進 bundle 的模組說明(#197):Vite 在 build 時把每份 `src/md/module-help/*.help.md`
 * 以原始字串內嵌,不走執行期的 fetch — 說明跟著版本走,離線也讀得到。
 *
 * `import.meta.glob` 是 Vite 的編譯期轉換,jest 沒有;測試以 `moduleNameMapper` 把本模組換成
 * `src/test/help-registry.ts` 的假 registry(同一份介面),見 `apps/admin/jest.config.mjs`。
 * 所以**本檔只放 glob**,判斷與整理都在 `lib/module-help.ts`(那份有自己的單元測試)。
 */
const helpFiles = import.meta.glob("/src/md/module-help/*.help.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

const registry = buildHelpRegistry(helpFiles);

/** 模組 key → 說明內容(Markdown 原始碼);沒有對應的 help.md 時回 undefined。 */
export const moduleHelpMarkdown = (moduleKey: string): string | undefined =>
  registry.get(moduleKey);
