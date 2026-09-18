import "@testing-library/jest-dom/jest-globals";

import { afterAll, afterEach, beforeAll } from "@jest/globals";
import { cleanup } from "@testing-library/react";

import { defaultLocale } from "@repo/i18n";

import { INITIAL_SESSION_SNAPSHOT } from "../lib/auth/session-store";
import { LOCALE_STORAGE_KEY } from "../lib/locale";
import { useLocaleStore } from "../stores/useLocaleStore";
import { useSessionStore } from "../stores/useSessionStore";
import { server } from "./msw/server";

// TEST-03:前端 mock 在網路層 — 每個測試檔都掛 MSW,未被 handler 接住的請求直接視為錯誤
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  server.events.removeAllListeners();
  // zustand store 是模組層單例(重構 #116 前登入狀態與語言各自掛在每次 renderApp 新建的物件上),每個測試後歸零;
  // 路由頁籤 store 不需要:殼 mount 時 `bind` 一律以 sessionStorage 覆蓋,測試各自 `sessionStorage.clear()`
  useSessionStore.setState(INITIAL_SESSION_SNAPSHOT);
  useLocaleStore.setState({ locale: defaultLocale });
  localStorage.removeItem(LOCALE_STORAGE_KEY);
});

afterAll(() => {
  server.close();
});
