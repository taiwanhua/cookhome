import {
  addOrgMembers,
  createChildOrg,
  createDemoItemOne,
  dataScopeRule,
  setOrgVisibility,
  setUserOrgsWithPolicy,
  switchOrg,
} from "../fixtures/api";
import {
  DEMO_ITEMS_ONE_COLLECTION,
  ORG_MANAGER_ROUTE,
  ROLE_MANAGER_ROUTE,
  SAMPLE_ONE_LIST_ROUTE,
  USER_MANAGER_ROUTE,
} from "../fixtures/demo-keys";
import { createScenarioDemoItems } from "../fixtures/scenario-demo-items";
import { expect, test } from "../fixtures/test";
import {
  expectDemoItems,
  readGovernancePages,
  signIn,
  toggleOrgVisibility,
  userRow,
} from "../fixtures/ui";

/**
 * 劇本 12 — 可見性開關
 * 正本:`docs/testing/permission-scenarios.md`「劇本 12」。用哪一頁:組織管理(編輯租戶頂層的開關)
 * + 示範模組1 列表 + 三個治理頁;帳號:+tenant 切開關並看治理頁、+tenant / +user 看列表。
 *
 * 兩個帳號要**同時**在線(+tenant 切開關、+user 重新整理看結果),所以 +user 用預設的 `page`、
 * +tenant 用自己一個 context 的第二個分頁(fixture 名叫 `rootPage`,這裡登入的是 +tenant)。
 *
 * **前置與文件字面不同的兩處**(照字面驗不出收縮,見 PR「規則回饋」):
 * - 可見範圍 = **所有**所屬組織的聯集(ADR-0005)。共同前置第 3 步把 +tenant 也加進了南港店,
 *   於是開關 OFF 時他仍看得到南港店那三筆,文件預期的「只剩租戶頂層那筆」不成立 ——
 *   所以四筆建完後把 +tenant 從南港店移出(選「保留所有角色授予」,他的角色擁有組織是租戶頂層,不受影響)。
 * - +user 只屬南港店、南港店底下沒有組織,ON / OFF 對他看不出差別。所以在南港店底下另建
 *   「南港倉庫」,由 +tenant 站在那裡建一筆 —— ON 時 +user 看得到(南港店的下層),OFF 就收縮掉。
 *
 * 新開通的租戶沒有設定開關 = `OWN`(ADR-0005 的保守預設),所以先用 api 設成 `SUBTREE`,
 * UI 走的是劇本真正要驗的 ON → OFF;切回 ON 走 api。
 */

const WAREHOUSE = "南港倉庫";
const SUPPORT_ROLE = "客服";
const VISIBILITY_SAVED = "已儲存組織資料。";

test("劇本 12:可見性開關 ON → OFF → 業務資料收縮、角色授予與治理頁不動;切回 ON 恢復", async ({
  page,
  rootPage: adminPage,
  tenant,
}) => {
  const { member, tenantAdmin, tenantOrgId, tenantOrgName, nangangOrgId } =
    tenant;

  // 前置 0:資料範圍規則是全站共用的一份 —— 先確定示範模組1 沒有任何規則,否則兩層收縮混在一起
  const rule = await dataScopeRule(tenant.rootToken, DEMO_ITEMS_ONE_COLLECTION);
  expect(rule?.rules ?? []).toEqual([]);

  // 前置 1:共同前置的四筆(+user 南港 2 筆、+tenant 南港 1 筆 / 租戶頂層 1 筆)
  const items = await createScenarioDemoItems(tenant);

  // 前置 2:南港店底下的「南港倉庫」+ 一筆資料(+tenant 暫時加入、站在那裡建)
  const warehouseOrgId = await createChildOrg(
    tenantAdmin.token,
    nangangOrgId,
    WAREHOUSE,
  );
  await addOrgMembers(tenantAdmin.token, warehouseOrgId, [tenantAdmin.userId]);
  const warehouseItem = `倉庫-他人-${tenant.slug}`;
  await createDemoItemOne(await switchOrg(tenantAdmin.token, warehouseOrgId), {
    name: warehouseItem,
  });

  // 前置 3:+tenant 只留租戶頂層(文件前置的所屬組織),角色授予全部保留
  await setUserOrgsWithPolicy(tenantAdmin.token, {
    userId: tenantAdmin.userId,
    orgIds: [tenantOrgId],
    dryRun: false,
    removalPolicy: "KEEP_ALL",
  });

  // 前置 4:開關設成 ON(可見下層)
  await setOrgVisibility(tenantAdmin.token, tenantOrgId, "SUBTREE");

  const allFive = [
    ...items.memberVisibleOne,
    items.peerAtTenantTop.name,
    warehouseItem,
  ];
  const memberOn = [...items.memberVisibleOne, warehouseItem];

  // 步驟 1:ON —— +tenant 看得到租戶頂層那筆與底下的全部;+user 看得到南港店 + 南港倉庫
  await signIn(adminPage, tenantAdmin.account, tenantAdmin.password);
  await adminPage.goto(SAMPLE_ONE_LIST_ROUTE);
  await expectDemoItems(adminPage, { total: 5, visible: allFive });

  await signIn(page, member.account, member.password);
  await page.goto(SAMPLE_ONE_LIST_ROUTE);
  await expectDemoItems(page, {
    total: 4,
    visible: memberOn,
    hidden: [items.peerAtTenantTop.name],
  });
  // 步驟 4(順手):「客服」沒有 `system.field-manager.view`,列表沒有分類篩選
  await expect(page.getByRole("combobox", { name: "分類" })).toHaveCount(0);

  // 步驟 3 的對照組:ON 時三個治理頁在 +tenant 視角列了什麼
  const anchors = {
    orgName: WAREHOUSE,
    account: member.account,
    roleName: SUPPORT_ROLE,
  };
  const routes = {
    org: ORG_MANAGER_ROUTE,
    user: USER_MANAGER_ROUTE,
    role: ROLE_MANAGER_ROUTE,
  };
  const before = await readGovernancePages(adminPage, anchors, routes);
  expect(before.orgTree).toEqual(
    expect.arrayContaining([tenantOrgName, "南港店", "內湖店", WAREHOUSE]),
  );

  // 步驟 2:+tenant → 組織管理 → 編輯租戶頂層 → 開關 ON → OFF → 儲存
  await adminPage.goto(ORG_MANAGER_ROUTE);
  await toggleOrgVisibility(adminPage, tenantOrgName, { isOn: true });
  await expect(adminPage.getByText(VISIBILITY_SAVED)).toBeVisible();

  // 步驟 2 的預期:業務資料收縮成只剩自己所屬組織的資料
  // +tenant(只屬租戶頂層)只剩頂層那一筆
  await adminPage.goto(SAMPLE_ONE_LIST_ROUTE);
  await expectDemoItems(adminPage, {
    total: 1,
    visible: [items.peerAtTenantTop.name],
    hidden: memberOn,
  });
  // +user(只屬南港店)重新整理 → 南港倉庫那筆不見了,南港店的三筆還在
  await page.goto(SAMPLE_ONE_LIST_ROUTE);
  await expectDemoItems(page, {
    total: 3,
    visible: items.memberVisibleOne,
    hidden: [warehouseItem, items.peerAtTenantTop.name],
  });

  // 步驟 3:同一個狀態下,三個治理頁在 +tenant 視角完全不變(管理範圍不看可見性開關)
  const after = await readGovernancePages(adminPage, anchors, routes);
  expect(after).toEqual(before);

  // 既有的角色授予不動:使用者管理那一列的角色欄、角色管理「分配使用者」都還列著 +user
  await adminPage.goto(USER_MANAGER_ROUTE);
  await expect(userRow(adminPage, member.account)).toContainText(SUPPORT_ROLE);
  await adminPage.goto(ROLE_MANAGER_ROUTE);
  await adminPage
    .getByRole("list", { name: "角色清單" })
    .getByText(SUPPORT_ROLE, { exact: true })
    .click();
  await adminPage.getByRole("tab", { name: "分配使用者" }).click();
  await expect(
    adminPage
      .getByRole("table", { name: "角色持有人清單" })
      .getByText(member.account, { exact: true }),
  ).toBeVisible();

  // 切回 ON(api)→ 兩邊都恢復成步驟 1
  await setOrgVisibility(tenantAdmin.token, tenantOrgId, "SUBTREE");
  await page.goto(SAMPLE_ONE_LIST_ROUTE);
  await expectDemoItems(page, {
    total: 4,
    visible: memberOn,
    hidden: [items.peerAtTenantTop.name],
  });
  await adminPage.goto(SAMPLE_ONE_LIST_ROUTE);
  await expectDemoItems(adminPage, { total: 5, visible: allFive });
});
