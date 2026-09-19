import { existsSync, statSync } from "node:fs";
import path from "node:path";

import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";
import onlyWarn from "eslint-plugin-only-warn";
import sonarjs from "eslint-plugin-sonarjs";
import turboPlugin from "eslint-plugin-turbo";
import unicorn from "eslint-plugin-unicorn";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

/**
 * A shared ESLint configuration for the repository.
 *
 * 組合(積木式,全部與 Prettier 相容):
 * - typescript-eslint strictTypeChecked + stylisticTypeChecked:型別感知的 bug 偵測
 * - import-x:import 衛生(循環依賴、重複、解析)
 * - unicorn:現代寫法慣例
 * - sonarjs:複雜度與程式碼氣味
 * - eslint-config-prettier 放最後,關閉所有與格式化衝突的規則
 */
/** 從檔案往上找最近的 package.json 所在目錄(= 該 app 的根)。 */
const packageRootOf = (file) => {
  let dir = path.dirname(file);
  while (!existsSync(path.join(dir, "package.json"))) {
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return dir;
};

const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs"];

/** `@/x` → `<app 根>/src/x`(檔案或目錄 index);不是 `@/` 開頭的交給下一個 resolver。 */
const srcAliasResolver = {
  interfaceVersion: 3,
  name: "src-alias",
  resolve(source, file) {
    if (!source.startsWith("@/")) return { found: false };
    const root = packageRootOf(file);
    if (root === null) return { found: false };
    const base = path.join(root, "src", source.slice(2));
    const candidates = [
      base,
      ...RESOLVE_EXTENSIONS.map((ext) => base + ext),
      ...RESOLVE_EXTENSIONS.map((ext) => path.join(base, "index" + ext)),
    ];
    const hit = candidates.find(
      (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
    );
    return hit === undefined ? { found: false } : { found: true, path: hit };
  },
};

export const config = defineConfig(
  globalIgnores(["dist/**"]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  unicorn.configs.recommended,
  sonarjs.configs.recommended,
  eslintConfigPrettier,
  {
    // 型別感知 lint 的引擎:自動對應到各套件自己的 tsconfig
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    // import-x 的模組解析:先認 `@/` 路徑別名(GEN-01:`@/` = 該 app 的 src/,與 tsconfig paths、
    // Vite alias、jest moduleNameMapper 同一份約定),其餘交給 TypeScript resolver(新介面,認 exports 子路徑)。
    // 別名自己解而不靠 TS resolver 讀 tsconfig paths:eslint-import-resolver-typescript 4.4 對這組 paths 解不出來。
    settings: {
      "import-x/resolver-next": [
        srcAliasResolver,
        createTypeScriptImportResolver(),
      ],
    },
  },
  {
    // 純 JS 設定檔不做型別分析(它們不在 tsconfig 範圍內)
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    rules: {
      // 強制走 @repo/logger,不直接用 console(logger 套件內部以行內註解豁免)
      "no-console": "error",
      // monorepo 最怕的循環依賴
      "import-x/no-cycle": "error",
      // props → properties 這類展開縮寫的要求太吵,不採用
      "unicorn/prevent-abbreviations": "off",
      // Prisma / GraphQL 生態大量使用 null,禁用不切實際
      "unicorn/no-null": "off",
      // reduce 的可讀性見仁見智,不禁用
      "unicorn/no-array-reduce": "off",
    },
  },
  {
    // __tests__ 是 Jest 的目錄慣例,不受 kebab-case 檔名規則約束
    files: ["**/__tests__/**"],
    rules: {
      "unicorn/filename-case": "off",
    },
  },
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  {
    plugins: {
      onlyWarn,
    },
  },
);
