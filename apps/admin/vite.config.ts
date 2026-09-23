import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // `@/` = src/(與 tsconfig paths、jest moduleNameMapper 同一份約定,GEN-01)
    alias: { "@": fileURLToPath(new URL("src", import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        /**
         * 把幾乎不隨改版變動的第三方程式碼切出獨立 chunk(#215)。兩個目的:
         * ①**快取命中率** —— 這些 chunk 首頁一樣要載(index.html 會一起 modulepreload,
         * 不產生瀑布),但每次部署後回訪的人不必重抓 MUI / React;
         * ②每個 chunk 都壓到 500 kB 以下,vite 的大小提醒才回到「有事才叫」的狀態
         * (所以不用調 `build.chunkSizeWarningLimit` 把提醒關掉)。
         * `@mui/x-*`(tree-view / date-pickers)自己就佔 440 kB,要與 `@mui/material` 分開才過線。
         * 真正要減少初次載入量的是路由層的 `React.lazy`,那是另一件事。
         * 命名對齊 rolldown 1.2 的新名字 `codeSplitting`(舊名 `advancedChunks` 已 deprecated)。
         */
        codeSplitting: {
          groups: [
            { name: "mui-x", test: /[\\/]node_modules[\\/]@mui[\\/]x-/ },
            {
              name: "mui-icons",
              test: /[\\/]node_modules[\\/]@mui[\\/]icons-/,
            },
            { name: "mui", test: /[\\/]node_modules[\\/](@mui|@emotion)[\\/]/ },
            {
              name: "react-vendor",
              test: /[\\/]node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
            },
          ],
        },
      },
    },
  },
});
