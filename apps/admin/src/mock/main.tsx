import "@fontsource-variable/public-sans";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app/App";

import { startMockWorker } from "./browser";

/**
 * mock 開發模式的進入點(`mock.html` 專用,正式 build 的入口是 `src/app/main.tsx`)。
 * 渲染的是**真的 `App`**(同一組 providers、路由與頁面),差別只在網路層被 MSW 的
 * service worker 接管 —— 這樣截到的圖才是正式畫面,而不是測試 harness 的樣子。
 */
const element = document.querySelector("#root");
if (!element) {
  throw new Error("Could not find root element");
}

await startMockWorker(globalThis.location.search);

createRoot(element).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
