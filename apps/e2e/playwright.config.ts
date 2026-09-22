import { defineConfig, devices } from "@playwright/test";

import { ADMIN_URL, GREP } from "./src/config";

/**
 * 劇本 E2E(TEST-05 / TEST-11):**只在手動觸發時跑**,不進每個 PR 的 CI。
 *
 * - 瀏覽器只裝 chromium(`pnpm --filter @repo/e2e e2e:browser`);多瀏覽器對權限劇本沒有增益。
 * - stack 由 `globalSetup` 起(Mongo → migrate → seed → api → admin),`globalTeardown` 收。
 * - `workers: 1`:整套只有一座 api,序列跑最穩;隔離靠「一條劇本一個租戶」而不是靠平行度。
 */
export default defineConfig({
  testDir: "./src/specs",
  testMatch: "**/*.spec.ts",
  // E2E_GREP="劇本 7" pnpm e2e —— 手動觸發 workflow 時也是同一個變數
  ...(GREP === "" ? {} : { grep: new RegExp(GREP) }),
  globalSetup: "./src/harness/global-setup.ts",
  globalTeardown: "./src/harness/global-teardown.ts",
  // 前置要開通租戶、建組織 / 使用者 / 角色,再跑畫面;單一測試給 3 分鐘
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env.CI === "true",
  retries: process.env.CI === "true" ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: ADMIN_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    locale: "zh-TW",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
