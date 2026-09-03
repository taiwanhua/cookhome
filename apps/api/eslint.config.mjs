import { config } from "@repo/eslint-config";

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    rules: {
      // NestJS 的 Module 是空 class、Service 依賴裝飾器注入 — 這條會誤殺
      "@typescript-eslint/no-extraneous-class": "off",
      // api 編譯成 CommonJS,沒有 top-level await 可用
      "unicorn/prefer-top-level-await": "off",
    },
  },
];
