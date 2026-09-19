/** @type {import('jest').Config} */
const config = {
  preset: "@repo/jest-presets/browser-esm",
  setupFilesAfterEnv: ["<rootDir>/src/test/setup.ts"],
  moduleNameMapper: {
    // `@/` = src/(GEN-01 路徑別名;與 tsconfig paths、vite alias 同一份約定)
    "^@/(.*)$": "<rootDir>/src/$1",
    // Vite 才懂的資源匯入(css / 字型)在測試中以空模組代替
    "\\.css$": "<rootDir>/src/test/empty-module.ts",
  },
};

export default config;
