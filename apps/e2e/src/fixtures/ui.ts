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

/**
 * 頁面區域(`AdminShell/ShellLayout` 的 `<main>`)。
 *
 * **右下角的 Snackbar 不在這裡面** —— 它掛在 `app/providers/SnackbarProvider` 上、是整個
 * app 根層的兄弟節點。自 #376 起同一句錯誤文案會**同時**出現在頁內橫幅與 Snackbar 兩處
 * (前者說明脈絡、後者是全站回饋,兩個都要留),所以驗頁內文案時一律從這個範圍往下找,
 * 否則 `getByText` 會撞上 strict mode。
 */
export function pageArea(page: Page): Locator {
  return page.getByRole("main");
}

/**
 * 頁內的橫幅錯誤(表單底部的 `Alert`,`shared/DemoForm.tsx`)。
 * 用 `role=alert` 定位、範圍限在 `<main>` 內 —— 理由同 `pageArea`。
 */
export function pageAlert(page: Page): Locator {
  return pageArea(page).getByRole("alert");
}

/** 無權限頁(`app/guards/ForbiddenPage.tsx`)。 */
export async function expectForbiddenPage(page: Page): Promise<void> {
  await expect(
    page.getByRole("heading", { name: "沒有權限進入此頁面" }),
  ).toBeVisible();
}
