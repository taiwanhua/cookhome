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

/**
 * 側欄(`AdminShell/SideNav` 的 `<nav aria-label="主選單">`)。
 * 模組列是連結(`NavLinkItem`,名稱 = 模組名稱);斷「有沒有某一列」時從這個範圍往下找,
 * 路由頁籤或頁面標題裡的同名文字才不會混進來。
 */
export function sideNav(page: Page): Locator {
  return page.getByRole("navigation", { name: "主選單" });
}

/** 角色管理的權限矩陣(`MatrixTree` 的 `aria-label`);斷「樹上有沒有某一列」時的範圍。 */
export function matrixTree(page: Page): Locator {
  return page.getByRole("tree", { name: "權限矩陣" });
}

/**
 * 重新登入:清掉 refresh cookie 再走登入頁(劇本 13 要看的是**登入後的落點**)。
 * access token 只在記憶體裡,`signIn` 的 `page.goto` 是完整導覽,清掉 cookie 就回到未登入。
 */
export async function signInAgain(
  page: Page,
  account: string,
  password: string,
): Promise<void> {
  await page.context().clearCookies();
  await signIn(page, account, password);
}

/* ---- 劇本 8 / 9(#398):使用者管理的所屬組織彈窗、「組織外」標示 ---- */

/** 「組織外」標籤的文案(使用者管理 / 分配使用者 / 指派角色三處同一句)。 */
export const OUT_OF_SCOPE_TAG = "組織外";

/** 使用者管理清單(`UserTable` 的 `aria-label`)裡、帳號是 `account` 的那一列。 */
export function userRow(page: Page, account: string): Locator {
  return page
    .getByRole("table", { name: "使用者清單" })
    .getByRole("row")
    .filter({ has: page.getByText(account, { exact: true }) });
}

/**
 * 畫面上唯一開著的那個彈窗,以它自己的按鈕辨認(`@repo/ui/dialog` 的標題不是無障礙名字)。
 * 用按鈕而不是標題:標題含全形 / 半形標點,照打很容易打錯(issue-tracker「全形 / 半形標點」)。
 */
export function dialogWithButton(page: Page, buttonName: string): Locator {
  return page
    .getByRole("dialog")
    .filter({ has: page.getByRole("button", { name: buttonName }) });
}

/** 組織樹某一列的勾選框(列文字 = 組織名稱;同一棵樹內分店名稱不重複)。 */
export function orgTreeCheckbox(scope: Locator, orgName: string): Locator {
  return scope
    .locator(".MuiTreeItem-content")
    .filter({ has: scope.page().getByText(orgName, { exact: true }) })
    .locator('input[type="checkbox"]');
}

/**
 * 按一個按鈕、等那一次 GraphQL 回應,回傳它的 `data`(要斷言 payload 內容時用;
 * 只要同步點用 `clickAndWaitFor`)。
 */
export async function clickAndReadData(
  button: Locator,
  operationName: string,
): Promise<Record<string, unknown>> {
  const [response] = await Promise.all([
    button
      .page()
      .waitForResponse(
        (candidate) =>
          candidate.url().includes("/graphql") &&
          (candidate.request().postData() ?? "").includes(operationName),
      ),
    button.click(),
  ]);
  const body = (await response.json()) as { data: Record<string, unknown> };
  return body.data;
}

/**
 * 使用者管理 → 那一列的「所屬組織」→ 在「選擇所屬組織」彈窗(`OrgPickerDialog`)取消勾選 `orgName`
 * → 確定。有移除就會先送 `setUserOrgs(dryRun: true)`,回來後換成「確認所屬組織變更」彈窗
 * (`OrgChangeDialog`),回傳那個彈窗。
 */
export async function removeUserOrgInPicker(
  page: Page,
  account: string,
  orgName: string,
): Promise<Locator> {
  await userRow(page, account)
    .getByRole("button", { name: "所屬組織" })
    .click();
  const picker = dialogWithButton(page, "確定");
  const checkbox = orgTreeCheckbox(picker, orgName);
  await expect(checkbox).toBeChecked();
  await checkbox.click();
  await expect(checkbox).not.toBeChecked();
  await clickAndWaitFor(page, "確定", "SetUserOrgs");
  const confirm = dialogWithButton(page, "確認變更");
  await expect(confirm).toBeVisible();
  return confirm;
}

/** `OrgChangeDialog` 的三個 radio(文案正本 `docs/modules/user-manager.md` 的 radio 文案表)。 */
export const REMOVAL_OPTIONS = {
  keepAll: "保留所有角色授予",
  revokeOwned: "只解除此組織擁有的角色",
  revokeAll: "解除所有因此失去資格的角色",
} as const;

/**
 * 某一檔的 radio 與它整個標籤(標籤 = 檔名 + 「將解除:…」那一行說明)。
 * 說明列的是**這一檔會解除哪些授予**,劇本 9 的 (b) / (c) 差異就是比這一行。
 */
export function removalOption(
  dialog: Locator,
  option: keyof typeof REMOVAL_OPTIONS,
): { radio: Locator; label: Locator } {
  const text = REMOVAL_OPTIONS[option];
  return {
    radio: dialog.getByRole("radio", { name: text }),
    label: dialog.locator("label").filter({ hasText: text }),
  };
}

/* ---- 劇本 12(#399):可見性開關、治理頁不動 ---- */

/** 可見性開關的文案(`admin.orgManager.form.visibility`;文件寫的「使用者可見下層組織資料」是簡稱)。 */
export const VISIBILITY_SWITCH = "使用者可見自身組織的下層組織資料";

/** 組織管理的組織樹(`OrgTreePanel` 的 `aria-label`;預設全部展開)。 */
export function orgTree(page: Page): Locator {
  return page.getByRole("tree", { name: "組織樹" });
}

/**
 * 組織管理 → 選 `orgName` →「編輯」→ 把可見性開關從 `from` 切到另一邊 →「儲存」。
 * 只動開關時編輯彈窗只送 `setOrgVisibility` 一個 mutation(`EditOrgDialog` 依「有變的欄位」送),
 * 所以等的就是它。呼叫前要已經在組織管理頁上。
 */
export async function toggleOrgVisibility(
  page: Page,
  orgName: string,
  from: { isOn: boolean },
): Promise<void> {
  await orgTree(page).getByText(orgName, { exact: true }).click();
  await page.getByRole("button", { name: "編輯", exact: true }).click();
  const dialog = dialogWithButton(page, "儲存");
  const toggle = dialog.getByRole("switch", { name: VISIBILITY_SWITCH });
  await expect(toggle).toBeChecked({ checked: from.isOn });
  await toggle.click();
  await expect(toggle).toBeChecked({ checked: !from.isOn });
  await clickAndWaitFor(page, "儲存", "SetOrgVisibility");
  await expect(dialog).toBeHidden();
}

/** 三個治理頁各自「畫面上列了什麼」(比對切開關前後用)。 */
export interface GovernanceSnapshot {
  /** 組織管理的樹:每個節點的標籤(依畫面順序)。 */
  orgTree: string[];
  /** 使用者管理的清單:每一列的文字(含表頭)。 */
  userRows: string[];
  /** 角色管理的左清單:整份文字(含分組標題)。 */
  roleList: string[];
}

/**
 * 依序打開組織管理 / 使用者管理 / 角色管理,讀出畫面上列著的東西。
 *
 * 每一頁先等一個「一定在」的錨點出現(清單還在路上時讀到的是空的),錨點由呼叫端給:
 * 樹上最深的那個組織、清單上一定有的帳號、一定有的角色。路由也由呼叫端給(`demo-keys.ts`)。
 */
export async function readGovernancePages(
  page: Page,
  anchors: { orgName: string; account: string; roleName: string },
  routes: { org: string; user: string; role: string },
): Promise<GovernanceSnapshot> {
  await page.goto(routes.org);
  const tree = orgTree(page);
  await expect(tree.getByText(anchors.orgName, { exact: true })).toBeVisible();
  const orgLabels = await tree.locator(".MuiTreeItem-label").allInnerTexts();

  await page.goto(routes.user);
  const users = page.getByRole("table", { name: "使用者清單" });
  await expect(users.getByText(anchors.account, { exact: true })).toBeVisible();
  const userRows = await users.getByRole("row").allInnerTexts();

  await page.goto(routes.role);
  const roles = page.getByRole("list", { name: "角色清單" });
  await expect(
    roles.getByText(anchors.roleName, { exact: true }),
  ).toBeVisible();
  const roleList = await roles.allInnerTexts();

  return { orgTree: orgLabels, userRows, roleList };
}
