import { ROOT_ACCOUNT, ROOT_PASSWORD } from "../config";
import {
  clearDataScopeRule,
  ownedByOperatorRule,
  saveDataScopeRule,
} from "../fixtures/api";
import {
  DATA_SCOPE_ROUTE,
  DEMO_ITEMS_ONE_COLLECTION,
  DEMO_ITEMS_TWO_COLLECTION,
  SAMPLE_ONE,
  SAMPLE_ONE_LIST_ROUTE,
  SAMPLE_TWO_LIST_ROUTE,
} from "../fixtures/demo-keys";
import { createScenarioDemoItems } from "../fixtures/scenario-demo-items";
import { expect, test } from "../fixtures/test";
import { expectDemoItems, signIn } from "../fixtures/ui";

/**
 * 劇本 3 — 未宣告對照
 * 正本:`docs/testing/permission-scenarios.md`「劇本 3」。
 * 用哪一頁:「資料範圍」頁左清單(root)+ 示範模組2 列表(+user)。
 *
 * 要驗的是「**沒有宣告 `dataScopeTarget` 的模組,規則機制根本不介入**」:
 * 左清單只有示範模組1 的 `demo_items_one`,示範模組2 的查詢只剩可見範圍保底。
 * 規則本身是前置,所以走 api(TEST-11);劇本 2 已經在畫面上驗過怎麼建。
 */

test("劇本 3:資料目標清單只有示範項目,示範模組2 的列表不受規則影響", async ({
  page,
  rootPage,
  tenant,
}) => {
  const items = await createScenarioDemoItems(tenant);

  // 前置:維持劇本 2 的規則開啟狀態(套用對象 = 客服角色 → 建立者【操作者本人】)
  await saveDataScopeRule(tenant.rootToken, {
    moduleKey: SAMPLE_ONE,
    combineOp: "OR",
    rules: [ownedByOperatorRule(tenant.supportRoleId)],
  });

  // 步驟 1:root → 資料範圍頁 → 看左側的資料目標清單
  await signIn(rootPage, ROOT_ACCOUNT, ROOT_PASSWORD);
  await rootPage.goto(DATA_SCOPE_ROUTE);
  const targets = rootPage.getByRole("list", { name: "資料目標" });
  await expect(
    targets.getByText(DEMO_ITEMS_ONE_COLLECTION, { exact: true }),
  ).toBeVisible();
  // 預期:清單裡沒有 `demo_items_two` —— 示範模組2 的 seed 不宣告 `dataScopeTarget`
  await expect(
    targets.getByText(DEMO_ITEMS_TWO_COLLECTION, { exact: true }),
  ).toHaveCount(0);

  // 步驟 2 的前半:確認規則真的開著 —— +user 的示範模組1 列表只剩自己建的 2 筆
  await signIn(page, tenant.member.account, tenant.member.password);
  await page.goto(SAMPLE_ONE_LIST_ROUTE);
  await expectDemoItems(page, {
    total: 2,
    visible: [items.ownedOne.name, items.ownedTwo.name],
    hidden: [items.peerInNangang.name],
  });

  // 步驟 2:同一個人去看**示範模組2** → 不受規則影響,照樣看得到別人在南港店建的那筆;
  //「頂層-他人」仍然看不到 —— 那是可見範圍保底,不是規則
  await page.goto(SAMPLE_TWO_LIST_ROUTE);
  await expectDemoItems(page, {
    total: 2,
    visible: items.memberVisibleTwo,
    hidden: [items.two.peerAtTenantTop.name],
  });

  // 規則是**全域**設定(`data_scope_rules` 的 collection 唯一),測完清掉不留給後面的劇本
  await clearDataScopeRule(tenant.rootToken, SAMPLE_ONE);
});
