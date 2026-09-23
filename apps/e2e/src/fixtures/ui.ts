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
 * MUI 的 `TextField select`:點開下拉、點一個選項。
 * 下拉的無障礙名字只取浮動標籤(`SelectInput` 的 `aria-labelledby` 只指標籤),
 * 選中值不會混進名字裡;選單渲染在 `body` 底下的 Popover,所以選項從 `page` 查。
 */
export async function chooseOption(
  page: Page,
  label: string,
  option: string,
): Promise<void> {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

/**
 * 多選下拉(`slotProps={{ select: { multiple: true } }}`):勾一個選項後**選單不會自己關**,
 * 所以最後按 Esc 收掉,否則它會蓋住下一個要點的東西。
 */
export async function checkOption(
  page: Page,
  label: string,
  option: string,
): Promise<void> {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await page.keyboard.press("Escape");
}

/**
 * 按一個按鈕,並等那一次 GraphQL 操作真的回來。
 *
 * 同一個操作連按兩次時(劇本 4 的切 OR → 切 AND),Snackbar **不是**可靠的同步點:
 * 它 4 秒才自動關,上一則還在畫面上就會讓斷言提早綠,接著讀到的是還沒更新的清單。
 */
export async function clickAndWaitFor(
  page: Page,
  buttonName: string,
  operationName: string,
): Promise<void> {
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/graphql") &&
        (response.request().postData() ?? "").includes(operationName),
    ),
    page.getByRole("button", { name: buttonName }).click(),
  ]);
}

/**
 * 示範模組的列表:看得到哪幾筆、看不到哪幾筆、總筆數是多少。
 *
 * 先斷「共 N 筆」那一行:它是頁尾那一句(`<ns>.total`),清單還在路上時是「共 0 筆」,
 * 所以它也順便當「這一份清單已經回來了」的同步點。
 */
export async function expectDemoItems(
  page: Page,
  expected: {
    total: number;
    pageSize?: number;
    visible: readonly string[];
    hidden?: readonly string[];
  },
): Promise<void> {
  const pageSize = expected.pageSize ?? 10;
  await expect(
    page.getByText(
      `共 ${String(expected.total)} 筆,每頁 ${String(pageSize)} 筆`,
    ),
  ).toBeVisible();
  for (const name of expected.visible) {
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
  for (const name of expected.hidden ?? []) {
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  }
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
