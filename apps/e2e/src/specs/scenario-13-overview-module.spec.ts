import { OVERVIEW_MODULE, SAMPLE_ONE_LIST_ROUTE } from "../fixtures/demo-keys";
import { expect, test } from "../fixtures/test";
import {
  expectForbiddenPage,
  sideNav,
  signIn,
  signInAgain,
} from "../fixtures/ui";

/**
 * 劇本 13 — 總覽也是模組
 * 正本:`docs/testing/permission-scenarios.md`「劇本 13」。用哪一頁:角色管理 → 權限矩陣(前置走 api);
 * 結果看登入後的落點與側欄;帳號:+tenant 改矩陣、+user 登入。
 *
 * 總覽是正式模組(key `overview`,`seeds/modules/overview.ts`),不是寫死的首頁:
 * `/` 轉到「側欄深度優先第一個進得去的 link」(ADR-0011「路由與導向規則」、`firstLinkRoute`)。
 */

const OVERVIEW_ROUTE = "/overview";
const OVERVIEW_WILDCARD = `${OVERVIEW_MODULE}.*`;
const OVERVIEW_NAME = "總覽";

/**
 * 「客服」拿掉總覽後,+user 的側欄只剩示範家族:示範群組(order 2)→ 示範次群組(order 1)→
 * 示範模組1(order 1)是深度優先的第一個 link(示範模組2 在示範群組底下 order 2)。
 */
const FIRST_LINK_WITHOUT_OVERVIEW = SAMPLE_ONE_LIST_ROUTE;

/** 網址的路徑剛好是 `path`(不帶查詢字串;`/` 的導向是 `replace`,所以停下來的就是落點)。 */
const pathIs = (path: string) => (url: URL) => url.pathname === path;

test("劇本 13:角色沒綁總覽 → 登入落在側欄第一個能進的頁、手打 /overview 無權限;綁回去 → 落在 /overview", async ({
  page,
  tenant,
}) => {
  // 步驟 1:「客服」取消「總覽」模組與 `overview.*` → +user 重新登入
  await tenant.setSupportPermissions({
    omitModules: [OVERVIEW_MODULE],
    omitPermissions: [OVERVIEW_WILDCARD],
  });
  await signIn(page, tenant.member.account, tenant.member.password);

  await expect(page).toHaveURL(pathIs(FIRST_LINK_WITHOUT_OVERVIEW));
  // 側欄有畫出來(示範模組1 那一列在),但沒有「總覽」這一列
  await expect(
    sideNav(page).getByRole("link", { name: "示範模組1" }),
  ).toBeVisible();
  await expect(
    sideNav(page).getByRole("link", { name: OVERVIEW_NAME }),
  ).toHaveCount(0);

  // 步驟 2:手打 `/overview` → 無權限頁(明確說是權限問題,不是壞掉)
  await page.goto(OVERVIEW_ROUTE);
  await expectForbiddenPage(page);
  await expect(page).toHaveURL(pathIs(OVERVIEW_ROUTE));

  // 步驟 3:把「總覽」勾回去(模組 + `overview.*`)→ +user 重新登入,落回 `/overview`
  await tenant.setSupportPermissions({
    addPermissions: [OVERVIEW_WILDCARD],
  });
  await signInAgain(page, tenant.member.account, tenant.member.password);

  await expect(page).toHaveURL(pathIs(OVERVIEW_ROUTE));
  await expect(
    sideNav(page).getByRole("link", { name: OVERVIEW_NAME }),
  ).toBeVisible();
});
