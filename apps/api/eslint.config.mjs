import { config } from "@repo/eslint-config";
import { mongooseConfig } from "@repo/eslint-config/mongoose";

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  // 裸 Model 查詢禁令(ADR-0005):資料存取一律經 BaseRepository
  ...mongooseConfig,
  {
    rules: {
      // NestJS 的 Module 是空 class、Service 依賴裝飾器注入 — 這條會誤殺
      "@typescript-eslint/no-extraneous-class": "off",
      // api 編譯成 CommonJS,沒有 top-level await 可用
      "unicorn/prefer-top-level-await": "off",
    },
  },
];
