/** @type {import('jest').Config} */
const config = {
  preset: "@repo/jest-presets/browser-esm",
  setupFilesAfterEnv: ["<rootDir>/src/test/setup.ts"],
  // 先列的先贏:特例要排在通則 `^@/(.*)$` 前面
  moduleNameMapper: {
    // 模組說明的 registry 用 Vite 的 `import.meta.glob` 把 help.md 打包進 bundle(#197);
    // jest 沒有那個編譯期轉換,整支換成介面相同的假 registry(內容由測試用 `setHelpFiles` 決定)
    "^@/lib/help-registry$": "<rootDir>/src/test/help-registry.ts",
    // `@/` = src/(GEN-01 路徑別名;與 tsconfig paths、vite alias 同一份約定)
    "^@/(.*)$": "<rootDir>/src/$1",
    // Vite 才懂的資源匯入(css / 字型)在測試中以空模組代替
    "\\.css$": "<rootDir>/src/test/empty-module.ts",
  },
};

export default config;
