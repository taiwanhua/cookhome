import { noRawModelQuery } from "./rules/no-raw-model-query.js";

/**
 * `@repo` 自訂規則的 plugin。規則以 `@repo/<rule>` 引用(如 STRUCT-05 的豁免範例)。
 */
export const repoPlugin = {
  meta: { name: "@repo/eslint-plugin", version: "0.0.0" },
  rules: {
    "no-raw-model-query": noRawModelQuery,
  },
};

/**
 * 使用 Mongoose 的套件(目前只有 api)加上這段:裸 Model 查詢一律擋下(ADR-0005)。
 * 測試檔不在範圍內 — 測試需要直接操作 Model 準備與驗證資料;正式程式碼才是隔離要守的地方。
 */
export const mongooseConfig = [
  {
    files: ["**/*.ts"],
    ignores: ["**/*.test.ts", "**/__tests__/**"],
    plugins: { "@repo": repoPlugin },
    rules: {
      "@repo/no-raw-model-query": "error",
    },
  },
];
