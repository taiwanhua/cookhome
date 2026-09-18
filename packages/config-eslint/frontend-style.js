import { defineConfig } from "eslint/config";

/**
 * 前端程式碼風格(ADR-0012;規範 GEN-01、STRUCT-03、REACT-01 / 07)。
 * 各前端包(admin / front / ui)完成重構的那個 PR 才把它加進自己的 eslint.config;
 * 沒加之前既有程式碼不會紅。用法:
 *   import { config } from "@repo/eslint-config/vite";
 *   import { frontendStyle } from "@repo/eslint-config/frontend-style";
 *   /** @type {import("eslint").Linter.Config[]} *\/
 *   export default [...config, ...frontendStyle];
 *
 * 檔名規則只看第一段(unicorn 的 multipleFileExtensions 預設):`RouteTabs.drag.test.tsx` 檢 `RouteTabs`、
 * `vite-env.d.ts` 檢 `vite-env`,第二段以後不管。
 */

/** 元件檔 PascalCase(`SideNav.tsx`、`SideNav.test.tsx`、`Button.stories.tsx`);只看檔名,資料夾命名靠規範與 review(GEN-01)。 */
const componentFiles = {
  files: ["**/*.tsx"],
  ignores: [
    // app 組裝層的非元件 tsx(進入點、路由表、登記表)
    "**/main.tsx",
    "**/routes.tsx",
    "**/module-pages.tsx",
    // 測試支援檔(MSW handlers、renderApp)不是元件,維持 kebab
    "**/test/**",
    // Next.js app router 的路由檔由框架命名
    "**/app/**/page.tsx",
    "**/app/**/layout.tsx",
    "**/app/**/loading.tsx",
    "**/app/**/error.tsx",
    "**/app/**/not-found.tsx",
    "**/app/**/template.tsx",
    "**/app/**/default.tsx",
  ],
  rules: {
    "unicorn/filename-case": [
      "error",
      { case: "pascalCase", checkDirectories: false },
    ],
  },
};

/** hook 檔 camelCase(`useMe.ts`、`useRouteTabsStore.ts`)。 */
const hookFiles = {
  // 也抓 `use-me.ts` 這種寫成 kebab 的 hook,讓它被要求改成 camelCase
  files: ["**/use[A-Z]*.ts", "**/use[A-Z]*.tsx", "**/use-*.ts", "**/use-*.tsx"],
  rules: {
    "unicorn/filename-case": [
      "error",
      { case: "camelCase", checkDirectories: false },
    ],
  },
};

/** 其餘(工具、常數、型別、設定、測試支援)kebab-case;沿用 unicorn 預設,這裡只是把它寫明。 */
const otherFiles = {
  files: ["**/*.ts"],
  ignores: ["**/use[A-Z]*.ts", "**/use-*.ts"],
  rules: {
    "unicorn/filename-case": [
      "error",
      { case: "kebabCase", checkDirectories: false },
    ],
  },
};

/** 寫法:箭頭函數、元件用 arrow、單檔上限。 */
const style = {
  files: ["**/*.{ts,tsx}"],
  rules: {
    // 元件、hook、一般函式一律箭頭函數(REACT-01);需要 overload / function* 的以行內豁免附原因(STRUCT-05)
    "func-style": ["error", "expression", { allowArrowFunctions: true }],
    "prefer-arrow-callback": "error",
    "react/function-component-definition": [
      "error",
      {
        namedComponents: "arrow-function",
        unnamedComponents: "arrow-function",
      },
    ],
    // 300 行是目標(REACT-07),400 是 lint 的硬上限
    "max-lines": [
      "error",
      { max: 400, skipBlankLines: true, skipComments: true },
    ],
  },
};

/**
 * 分層 import 方向(STRUCT-03):app → pages → components → hooks / stores → lib。
 * 以 target(被 import 的層)禁止 from(上層)的方式宣告;路徑相對於各包根目錄(turbo 在包目錄執行 lint)。
 */
const layering = {
  files: ["src/**/*.{ts,tsx}"],
  rules: {
    "import-x/no-restricted-paths": [
      "error",
      {
        basePath: "./src",
        zones: [
          {
            target: "./lib",
            from: ["./hooks", "./stores", "./components", "./pages", "./app"],
            message: "lib 是最底層,不能 import 上層(STRUCT-03)",
          },
          {
            target: ["./hooks", "./stores"],
            from: ["./components", "./pages", "./app"],
            message:
              "hooks / stores 不能 import components、pages、app(STRUCT-03)",
          },
          {
            target: "./components",
            from: ["./pages", "./app"],
            message: "components 不能 import pages、app(STRUCT-03)",
          },
          {
            target: "./pages",
            from: "./app",
            message: "pages 不能 import app(STRUCT-03)",
          },
        ],
      },
    ],
  },
};

export const frontendStyle = defineConfig(
  componentFiles,
  hookFiles,
  otherFiles,
  style,
  layering,
);
