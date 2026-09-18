import "@testing-library/jest-dom/jest-globals";

import { afterAll, afterEach, beforeAll } from "@jest/globals";
import { cleanup } from "@testing-library/react";

import { server } from "./msw/server";

// TEST-03:前端 mock 在網路層 — 每個測試檔都掛 MSW,未被 handler 接住的請求直接視為錯誤
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  server.events.removeAllListeners();
});

afterAll(() => {
  server.close();
});
