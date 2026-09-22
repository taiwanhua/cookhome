/* eslint-disable no-empty-pattern -- Playwright 以第一個參數的解構樣式推導 fixture 相依,不需要任何相依的 fixture 只能寫 `{}`;到期條件:Playwright 提供其他宣告方式時改掉 */
import { type Page, test as base } from "@playwright/test";

import { type ScenarioTenant, createScenarioTenant } from "./scenario-tenant";

/**
 * 每條劇本自己的租戶(`createScenarioTenant` 會跑完「驗收前的準備」四步)。
 * 前置一律走 api,UI 只負責跑劇本真正要驗的那一段(TEST-11)。
 */
export interface ScenarioFixtures {
  tenant: ScenarioTenant;
  rootPage: Page;
}

export const test = base.extend<ScenarioFixtures>({
  tenant: async ({}, use) => {
    await use(await createScenarioTenant());
  },

  /**
   * 第二個分頁,**自己一個 context**:劇本 2 / 3 / 4 要 root 改規則、+user 同時在另一邊
   * 看結果,共用一個 context 等於共用 cookie,後登入的會把前一個踢掉。
   * 沿用 `contextOptions` 才拿得到設定檔的 `baseURL` / `locale`(`browser.newContext()` 不繼承)。
   */
  rootPage: async ({ browser, contextOptions }, use) => {
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";
