import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

/** @repo/ui 的原始碼位置:直接吃 src,改元件即時熱更新,不依賴 dist build */
const uiSrc = fileURLToPath(
  new URL("../../../packages/ui/src", import.meta.url),
).replaceAll("\\", "/");

const config: StorybookConfig = {
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  stories: [
    // 工具型頁面(Palette Lab 等)住在本 app
    "../stories/**/*.stories.@(ts|tsx)",
    // 元件 stories 與元件同居在 @repo/ui
    "../../../packages/ui/src/**/*.stories.@(ts|tsx)",
  ],
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, {
      resolve: {
        // pnpm 隔離 node_modules 下,強制整個 bundle 只用同一份 react / emotion / MUI,
        // 否則 @repo/ui 連到的副本與本 app 不同,會炸 "Cannot read properties of null (reading 'useContext')"
        dedupe: [
          "react",
          "react-dom",
          "@emotion/react",
          "@emotion/styled",
          "@mui/material",
        ],
        // @repo/ui/* 指向原始碼:出口檔就是 src/<子路徑>(bunchee 的慣例),
        // 元件本體在 PascalCase 資料夾裡由出口檔轉接;theme / icons 則由 vite 解到目錄的 index.ts
        alias: [{ find: /^@repo\/ui\/(.+)$/, replacement: `${uiSrc}/$1` }],
      },
    }),
};

export default config;
