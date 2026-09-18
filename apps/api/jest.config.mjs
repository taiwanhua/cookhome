import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * 沿用共用 preset,但 ts-jest 改為只轉譯不型別檢查(isolatedModules):
 * 型別由 `check-types`(tsc)把關;ts-jest 對 `@apollo/server` 的 ESM/CJS 型別解析與 tsc 不一致,
 * 且整張 Nest 依賴圖的型別檢查讓 supertest 整合測試啟動極慢。
 *
 * @type {import('jest').Config}
 */
const config = {
  preset: "@repo/jest-presets/node",
  transform: {
    "^.+\\.tsx?$": [require.resolve("ts-jest"), { isolatedModules: true }],
  },
  // `@repo/domain/<主題>` 直接對到套件原始碼:測試不依賴先 build(turbo 的 test 不 dependsOn ^build);
  // tsc / nest build 仍走 package.json exports 的 dist 產物
  moduleNameMapper: {
    "^@repo/domain/(.*)$": "<rootDir>/../../packages/domain/src/$1",
  },
};

export default config;
