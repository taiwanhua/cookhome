import { ModuleEngine } from "@repo/graphql";

/**
 * 模組說明(`src/md/module-help/<模組 key>.help.md`)的純邏輯:檔名 → 模組 key、內容整理、
 * 模組 → 該用哪一份(專屬檔優先,表單模組沒有專屬檔時退回通用檔)。
 * 真的去讀檔案的那一層在 `lib/help-registry.ts`(Vite 的 `import.meta.glob`,只有它碰得到打包器)。
 */

/** help.md 的副檔名;檔名其餘部分就是模組 key(`system.org-manager.help.md` → `system.org-manager`)。 */
const HELP_SUFFIX = ".help.md";

/**
 * glob 出來的路徑 → 模組 key;不是 help.md 的路徑回 null。
 * 路徑形如 `/src/md/module-help/system.org-manager.help.md`,分隔符兩種都吃(Windows 的 `\`)。
 */
export const moduleKeyFromHelpPath = (path: string): string | null => {
  if (!path.endsWith(HELP_SUFFIX)) {
    return null;
  }
  const fileName = path.split(/[/\\]/).at(-1) ?? "";
  const key = fileName.slice(0, -HELP_SUFFIX.length);
  return key === "" ? null : key;
};

/**
 * 去掉開頭那一層 `# 模組名`:彈窗標題已經寫了模組名(Figma Draft/HelpDialog 95:235 的內文
 * 就是從 `## 這個模組做什麼` 開始),再渲染一次是重複。只拔開頭連續空行後的第一個 `# `,
 * 內文中間的 h1(實務上沒有)保留。
 */
export const stripLeadingTitle = (markdown: string): string => {
  const lines = markdown.split("\n");
  const firstIndex = lines.findIndex((line) => line.trim() !== "");
  if (firstIndex === -1 || !lines[firstIndex]?.startsWith("# ")) {
    return markdown;
  }
  return lines
    .slice(firstIndex + 1)
    .join("\n")
    .trimStart();
};

/**
 * 「模組 key → 說明內容」對照表。`files` 是 `import.meta.glob` 的產物(路徑 → 原始字串),
 * 測試可以直接餵一份假的進來。空白(或只有標題)的 help.md 視為沒有說明,不收進表裡。
 */
export const buildHelpRegistry = (
  files: Readonly<Record<string, string>>,
): ReadonlyMap<string, string> => {
  const registry = new Map<string, string>();
  for (const [path, content] of Object.entries(files)) {
    const key = moduleKeyFromHelpPath(path);
    const body = stripLeadingTitle(content).trim();
    if (key !== null && body !== "") {
      registry.set(key, body);
    }
  }
  return registry;
};

/**
 * 表單模組的通用說明(`form-module.help.md`)在對照表裡的 key。表單模組的畫面都由表單引擎組裝、
 * 操作方式相同,所以不必各放一份;有特殊需求才加 `<模組 key>.help.md` 專屬檔。
 */
export const FORM_MODULE_HELP_KEY = "form-module";

/** 查說明要用到的模組欄位(`me.modules` 的一筆)。 */
export interface HelpModule {
  key: string;
  engine: ModuleEngine;
}

/**
 * 模組 → 說明內容:專屬檔優先;沒有專屬檔、而且是表單模組(`engine` = FORM)→ 表單模組通用說明;
 * 都沒有 → undefined(「?」停用)。彈窗標題由呼叫端用模組名,所以通用檔各模組共用也標得出是哪個模組。
 */
export const resolveModuleHelp = (
  registry: ReadonlyMap<string, string>,
  module: HelpModule,
): string | undefined =>
  registry.get(module.key) ??
  (module.engine === ModuleEngine.Form
    ? registry.get(FORM_MODULE_HELP_KEY)
    : undefined);
