import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "@repo/eslint-config";
import { mongooseConfig } from "@repo/eslint-config/mongoose";

const API_ROOT = path.dirname(fileURLToPath(import.meta.url));

/** 測試用的專案 fixture(以專案身分掛進真 AppModule;結構比照 `src/project/`)。 */
const PROJECT_FIXTURE = "src/test-support/project-fixture";

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
  {
    // 所有權方向:底座檔不得 import 專案來源,只有兩個固定組裝入口例外。
    // 專案 fixture 只豁免這一條(它要以專案身分接進入口),裸查禁令照樣適用。
    files: ["src/**/*.ts"],
    ignores: [
      "src/project/**",
      "src/app.module.ts",
      "src/database/database.module.ts",
      `${PROJECT_FIXTURE}/**`,
    ],
    rules: {
      "import-x/no-restricted-paths": [
        "error",
        {
          basePath: API_ROOT,
          zones: [
            {
              target: "./src",
              from: "./src/project",
              message:
                "底座不得 import 專案來源(src/project);只有 app.module.ts 與 database/database.module.ts 兩個組裝入口可以。",
            },
          ],
        },
      ],
    },
  },
  {
    // Mongoose 的注入 / 註冊工具只留在資料層:功能模組一律注入登記好的 repository,不自己拿 Model。
    files: ["src/**/*.ts"],
    ignores: [
      "src/app.module.ts",
      "src/database/**",
      "src/project/database/**",
      `${PROJECT_FIXTURE}/database/**`,
      "**/*.test.ts",
      "**/__tests__/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@nestjs/mongoose",
              importNames: [
                "InjectModel",
                "InjectConnection",
                "MongooseModule",
                "getModelToken",
                "getConnectionToken",
              ],
              message:
                "功能模組不自行注入或註冊 Mongoose model:model 與 repository 一律寫在資料登記(database/base/registrations.ts、project/database/registrations.ts)。",
            },
          ],
        },
      ],
    },
  },
];
