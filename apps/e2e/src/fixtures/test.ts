/* eslint-disable no-empty-pattern -- Playwright 以第一個參數的解構樣式推導 fixture 相依,不需要任何相依的 fixture 只能寫 `{}`;到期條件:Playwright 提供其他宣告方式時改掉 */
import { test as base } from "@playwright/test";

import { type ScenarioTenant, createScenarioTenant } from "./scenario-tenant";

/**
 * 每條劇本自己的租戶(`createScenarioTenant` 會跑完「驗收前的準備」四步)。
 * 前置一律走 api,UI 只負責跑劇本真正要驗的那一段(TEST-11)。
 */
export interface ScenarioFixtures {
  tenant: ScenarioTenant;
}

export const test = base.extend<ScenarioFixtures>({
  tenant: async ({}, use) => {
    await use(await createScenarioTenant());
  },
});

export { expect } from "@playwright/test";
