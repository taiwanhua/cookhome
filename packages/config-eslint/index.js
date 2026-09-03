import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import importX from "eslint-plugin-import-x";
import onlyWarn from "eslint-plugin-only-warn";
import sonarjs from "eslint-plugin-sonarjs";
import turboPlugin from "eslint-plugin-turbo";
import unicorn from "eslint-plugin-unicorn";
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
