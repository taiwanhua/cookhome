import { ROOT_ACCOUNT, ROOT_PASSWORD } from "../config";
import {
  clearDataScopeRule,
  ownedByOperatorRule,
  publishedInOrgRule,
  saveDataScopeRule,
  setDemoItemOneStatus,
} from "../fixtures/api";
import {
  DATA_SCOPE_ROUTE,
  DEMO_ITEMS_ONE_COLLECTION,
  SAMPLE_ONE_LIST_ROUTE,
} from "../fixtures/demo-keys";
import { createScenarioDemoItems } from "../fixtures/scenario-demo-items";
import { expect, test } from "../fixtures/test";
import {
  chooseOption,
  clickAndWaitFor,
  expectDemoItems,
  signIn,
} from "../fixtures/ui";

/**
 * 劇本 4 — 頂層合成 OR / AND
 * 正本:`docs/testing/permission-scenarios.md`「劇本 4」。
 * 用哪一頁:「資料範圍」頁(規則合成切換)+ 示範模組1 列表;
 * 帳號:root 設規則、+user 看結果。
 *
 * **兩條規則是前置**(走 api,TEST-11;劇本 2 已在畫面上驗過怎麼建一條),
 * 這一條要在畫面上跑的只有「切 OR / 切 AND → 儲存」那兩步。
 * 前置刻意存成 AND,步驟 2 的「切 OR」才是真的切一次。
 *
 * 四筆裡只有「南港-自建1」改成已發布,所以三種狀態的結果集兩兩不同:
 * 無規則 3 筆 → OR(聯集)2 筆 → AND(交集)1 筆。
 */

const COMBINE_OR = "OR — 命中任一規則即可(資料變多)";
const COMBINE_AND = "AND — 需滿足全部命中的規則(資料變少)";

test("劇本 4:兩條都命中 +user 的規則,OR 取聯集、AND 取交集", async ({
  page,
  rootPage,
  tenant,
}) => {
  const items = await createScenarioDemoItems(tenant);

  // 前置:把四筆之一改成「已發布」(其餘留草稿),讓兩條規則的結果集不相等
  await setDemoItemOneStatus(
    tenant.member.token,
    items.ownedOne.id,
    "PUBLISHED",
  );

  // 步驟 1:建兩條都會命中 +user 的規則
  // ①指定角色「客服」→ 建立者【操作者本人】;②指定組織「南港店」→ 狀態【已發布】
  //(套用對象比的是啟用中角色與**所屬組織的直接關聯**,所以②要寫南港店而不是租戶A)
  await saveDataScopeRule(tenant.rootToken, {
    collection: DEMO_ITEMS_ONE_COLLECTION,
    combineOp: "AND",
    rules: [
      ownedByOperatorRule(tenant.supportRoleId),
      publishedInOrgRule(tenant.nangangOrgId),
    ],
  });

  await signIn(page, tenant.member.account, tenant.member.password);
  await signIn(rootPage, ROOT_ACCOUNT, ROOT_PASSWORD);
  await rootPage.goto(DATA_SCOPE_ROUTE);
  await expect(rootPage.getByText("規則 1")).toBeVisible();
  await expect(rootPage.getByText("規則 2")).toBeVisible();

  // 步驟 2:頂層合成切 OR → 儲存 → +user 看列表
  await chooseOption(rootPage, "規則合成", COMBINE_OR);
  await clickAndWaitFor(rootPage, "儲存", "SaveDataScopeRule");

  // 預期:OR = 兩條的**聯集**(自建的 + 任何已發布的)。
  //「南港-他人」是別人建的草稿,兩條都沒命中它 —— 聯集也撈不到
  await page.goto(SAMPLE_ONE_LIST_ROUTE);
  await expectDemoItems(page, {
    total: 2,
    visible: [items.ownedOne.name, items.ownedTwo.name],
    hidden: [items.peerInNangang.name, items.peerAtTenantTop.name],
  });

  // 步驟 3:頂層合成切 AND → 儲存 → +user 再看列表
  await chooseOption(rootPage, "規則合成", COMBINE_AND);
  await clickAndWaitFor(rootPage, "儲存", "SaveDataScopeRule");

  // 預期:AND = **交集**(自己建的**且**已發布的)只剩一筆;
  // 兩種合成方式下租戶隔離都仍在最外層 ——「頂層-他人」不在 +user 的可見範圍,從頭到尾不出現
  await page.goto(SAMPLE_ONE_LIST_ROUTE);
  await expectDemoItems(page, {
    total: 1,
    visible: [items.ownedOne.name],
    hidden: [
      items.ownedTwo.name,
      items.peerInNangang.name,
      items.peerAtTenantTop.name,
    ],
  });

  // 規則是**全域**設定(`data_scope_rules` 的 collection 唯一),測完清掉不留給後面的劇本
  await clearDataScopeRule(tenant.rootToken, DEMO_ITEMS_ONE_COLLECTION);
});
