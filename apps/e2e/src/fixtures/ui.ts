import { type Locator, type Page, expect } from "@playwright/test";

/** admin 畫面上共用的操作與定位(TEST-11:UI 只走要驗的那一段,共用動作抽在這裡)。 */

/** 從登入頁登入;停在非登入頁才算成功。 */
export async function signIn(
  page: Page,
  account: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.locator('input[name="account"]').fill(account);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "登入" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/**
 * 權限矩陣的一列。
 *
 * 每一列的列尾都印著那一筆的 key(`MatrixTree` 的 `labelSuffix`),而 key 全樹唯一,
 * 所以用它定位最穩;子列住在自己的 `ul` 裡,不會被父列的 `.MuiTreeItem-content` 撈到。
 */
export function matrixRow(page: Page, key: string): Locator {
  return page
    .locator(".MuiTreeItem-content")
    .filter({ has: page.getByText(key, { exact: true }) });
}

/** 某一列自己的勾選框。 */
export function matrixCheckbox(page: Page, key: string): Locator {
  return matrixRow(page, key).locator('input[type="checkbox"]');
}

/** 無權限頁(`app/guards/ForbiddenPage.tsx`)。 */
export async function expectForbiddenPage(page: Page): Promise<void> {
  await expect(
    page.getByRole("heading", { name: "沒有權限進入此頁面" }),
  ).toBeVisible();
}
