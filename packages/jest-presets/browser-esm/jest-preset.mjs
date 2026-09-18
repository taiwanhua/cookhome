import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * 瀏覽器端 app(Vite SPA)用的 preset(#65 建立;admin 為第一個使用者):
 * - `jest-fixed-jsdom`:jsdom 之上補回 Node 的 fetch / Request / Response / BroadcastChannel 等全域,
 *   MSW(TEST-03)在網路層攔截需要它們
 * - ts-jest 走 ESM 模式:react-router 8、use-intl 4 只出 ESM;執行時需 `node --experimental-vm-modules`
 *   (見 apps/admin 的 test script)
 * 與 `browser` preset 的差別只在上述兩點;packages/ui 的元件測試沿用 `browser`。
 */
/** @type {import('jest').Config} */
const config = {
  roots: ["<rootDir>"],
  testEnvironment: require.resolve("jest-fixed-jsdom"),
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  transform: {
    "^.+\\.tsx?$": [require.resolve("ts-jest"), { useESM: true }],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "mjs", "jsx", "json", "node"],
  modulePathIgnorePatterns: [
    "<rootDir>/test/__fixtures__",
    "<rootDir>/node_modules",
    "<rootDir>/dist",
  ],
};

export default config;
