import { createDemoItemOne, revokeRoleUsers, switchOrg } from "../fixtures/api";
import {
  ORG_MANAGER_ROUTE,
  ROLE_MANAGER_ROUTE,
  SAMPLE_ONE_LIST_ROUTE,
  USER_MANAGER_ROUTE,
} from "../fixtures/demo-keys";
import { createScenarioDemoItems } from "../fixtures/scenario-demo-items";
import {
  addMemberToNeihu,
  grantMemberRoleOwnedBy,
} from "../fixtures/scenario-org-membership";
import { expect, test } from "../fixtures/test";
import {
  OUT_OF_SCOPE_TAG,
  clickAndWaitFor,
  dialogWithButton,
  expectDemoItems,
  removalOption,
  removeUserOrgInPicker,
  signIn,
  signInAgain,
  userRow,
} from "../fixtures/ui";

/**
 * 劇本 8 — 組織外
 * 正本:`docs/testing/permission-scenarios.md`「劇本 8」。用哪一頁:使用者管理(移除所屬組織)+
 * 角色管理「分配使用者」+ 指派角色彈窗 + 組織管理「成員」+ 示範模組1 列表;帳號:+tenant 操作、+user 受影響。
 *
 * **前置與文件字面不同的兩處**(文件的寫法驗不出來,見 PR「規則回饋」):
 * - 文件寫「+user 只屬南港店」,但最後一個所屬組織不可移除(`LAST_ORG`),所以 +user 另外加入內湖店;
 * - 文件寫「客服的擁有組織 = 租戶A」,但租戶頂層的子樹包住內湖店,移掉南港店後客服仍有支撐、不會變組織外。
 *   所以另建一個**擁有組織 = 南港店**的角色(權限照抄客服),並把客服從 +user 身上拿掉 ——
 *   步驟 3 他還進得去示範模組1,就只能是靠這個組織外的授予。
 */

const NANGANG_ROLE = "南港店長";
const ROLE_USERS_TABLE = "角色持有人清單";
const ORG_MEMBERS_TABLE = "組織成員清單";
const CREATE_BUTTON = "+ 新增示範項目";

test("劇本 8:移除所屬組織選保留 → 三處標示組織外、功能照常、資料範圍縮小", async ({
  page,
  tenant,
}) => {
  const { member, tenantAdmin } = tenant;

  // 前置(api):+user 在南港店建過資料(共同前置的那幾筆),再加入內湖店、在內湖店建一筆
  const items = await createScenarioDemoItems(tenant);
  await addMemberToNeihu(tenant);
  const neihuItem = `內湖-自建-${tenant.slug}`;
  await createDemoItemOne(await switchOrg(member.token, tenant.neihuOrgId), {
    name: neihuItem,
  });
  // 角色換成擁有組織 = 南港店的「南港店長」(客服拿掉)
  await grantMemberRoleOwnedBy(tenant, NANGANG_ROLE, tenant.nangangOrgId);
  await revokeRoleUsers(tenantAdmin.token, tenant.supportRoleId, [
    member.userId,
  ]);

  // 對照組:移除前 +user 看得到南港店的三筆 + 內湖店的一筆
  await signIn(page, member.account, member.password);
  await page.goto(SAMPLE_ONE_LIST_ROUTE);
  await expectDemoItems(page, {
    total: 4,
    visible: [...items.memberVisibleOne, neihuItem],
    hidden: [items.peerAtTenantTop.name],
  });

  // 步驟 1:+tenant → 使用者管理 → 把 +user 自南港店移除,radio 選「保留所有角色授予」
  await signInAgain(page, tenantAdmin.account, tenantAdmin.password);
  await page.goto(USER_MANAGER_ROUTE);
  const row = userRow(page, member.account);
  await expect(row.getByText(OUT_OF_SCOPE_TAG, { exact: true })).toHaveCount(0);

  const confirm = await removeUserOrgInPicker(page, member.account, "南港店");
  // dry-run 列出「南港店長」會失去資格(它就是這次要保留下來的授予)
  await expect(
    confirm.getByRole("listitem").filter({ hasText: NANGANG_ROLE }),
  ).toBeVisible();
  const keepAll = removalOption(confirm, "keepAll");
  await keepAll.radio.check();
  await expect(keepAll.radio).toBeChecked();
  await clickAndWaitFor(page, "確認變更", "SetUserOrgs");
  await expect(confirm).toBeHidden();

  // 步驟 2-1:使用者管理的角色欄 —— 授予還在,掛「組織外」
  await expect(row).toContainText(NANGANG_ROLE);
  await expect(row.getByText(OUT_OF_SCOPE_TAG, { exact: true })).toBeVisible();

  // 步驟 2-2:指派角色的彈窗 —— 已選清單上的那一筆也掛「組織外」
  await row.getByRole("button", { name: "指派角色" }).click();
  const assignDialog = dialogWithButton(page, "儲存指派");
  await expect(assignDialog).toContainText(NANGANG_ROLE);
  await expect(
    assignDialog.getByText(OUT_OF_SCOPE_TAG, { exact: true }),
  ).toBeVisible();
  await assignDialog.getByRole("button", { name: "取消" }).click();
  await expect(assignDialog).toBeHidden();

  // 步驟 2-3:角色管理 → 南港店長 →「分配使用者」—— +user 那一列掛「組織外」
  await page.goto(ROLE_MANAGER_ROUTE);
  await page.getByText(NANGANG_ROLE, { exact: true }).click();
  await page.getByRole("tab", { name: "分配使用者" }).click();
  const holder = page
    .getByRole("table", { name: ROLE_USERS_TABLE })
    .getByRole("row")
    .filter({ has: page.getByText(member.account, { exact: true }) });
  await expect(
    holder.getByText(OUT_OF_SCOPE_TAG, { exact: true }),
  ).toBeVisible();

  // 步驟 2 順手:組織管理 → 南港店 →「成員」—— +user 已不在;+tenant 還在(同步點)
  await page.goto(ORG_MANAGER_ROUTE);
  await page
    .getByRole("tree", { name: "組織樹" })
    .getByText("南港店", { exact: true })
    .click();
  await page.getByRole("tab", { name: "成員" }).click();
  const members = page.getByRole("table", { name: ORG_MEMBERS_TABLE });
  // 開通出來的擁有者姓名預設就是帳號,姓名與帳號兩格同字 —— 所以數「列」不數「格」
  await expect(
    members.getByRole("row").filter({ hasText: tenantAdmin.account }),
  ).toHaveCount(1);
  await expect(members.getByText(member.account, { exact: true })).toHaveCount(
    0,
  );

  // 步驟 3:+user 重新登入 → 照樣進得去示範模組1(授予還在),但只剩內湖店的那一筆
  await signInAgain(page, member.account, member.password);
  await page.goto(SAMPLE_ONE_LIST_ROUTE);
  await expectDemoItems(page, {
    total: 1,
    visible: [neihuItem],
    hidden: [...items.memberVisibleOne, items.peerAtTenantTop.name],
  });
  // 功能也還在:南港店長的 `create` 照常生效(組織外 ≠ 解除)
  await expect(page.getByRole("button", { name: CREATE_BUTTON })).toBeVisible();
});
