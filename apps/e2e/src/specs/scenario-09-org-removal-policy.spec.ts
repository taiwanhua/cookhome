import {
  createChildOrg,
  moveOrg,
  setUserOrgsWithPolicy,
} from "../fixtures/api";
import { USER_MANAGER_ROUTE } from "../fixtures/demo-keys";
import {
  addMemberToNeihu,
  grantMemberRoleOwnedBy,
} from "../fixtures/scenario-org-membership";
import { expect, test } from "../fixtures/test";
import {
  OUT_OF_SCOPE_TAG,
  clickAndReadData,
  removalOption,
  removeUserOrgInPicker,
  signIn,
  userRow,
} from "../fixtures/ui";

/**
 * 劇本 9 — 移除所屬組織的 dry-run 三檔
 * 正本:`docs/testing/permission-scenarios.md`「劇本 9」。用哪一頁:使用者管理 → 移除所屬組織的確認彈窗
 * (`OrgChangeDialog`);帳號:+tenant 操作,對象 = 同屬南港店 + 內湖店的 +user。
 *
 * (b)「只解除此組織擁有的」與 (c)「解除所有因此失去資格的」要**分得出來**,需要一個
 * 「不是被移除的組織擁有、卻只靠它支撐」的角色 —— 擁有組織是南港店的**上層**、而且不包住內湖店。
 * 文件字面的「一個擁有組織 = 南港店、一個 = 租戶A」分不出來(租戶A 的子樹包住內湖店,
 * 那個角色 (b)(c) 都不列),所以這裡把南港店搬到新建的「東區」底下,三個角色各落一種:
 *
 * | 角色     | 擁有組織 | 移除南港店後                          | (b) | (c) |
 * | -------- | -------- | ------------------------------------- | --- | --- |
 * | 南港店長 | 南港店   | 由被移除的組織擁有 + 失去子樹支撐     | 解除 | 解除 |
 * | 東區督導 | 東區     | 失去子樹支撐(東區底下只剩不屬的組織) | —   | 解除 |
 * | 客服     | 租戶A    | 內湖店仍在子樹內,不失去資格          | —   | —   |
 */

const NANGANG_ROLE = "南港店長";
const EAST_ROLE = "東區督導";
const SUPPORT_ROLE = "客服";

/** `admin.userManager.orgChange.reasons` 的兩條(zh-TW 字典原樣)。 */
const REASON_OWNED = "由被移除的組織擁有";
const REASON_NO_SUPPORT = "剩餘的所屬組織都不在該角色的擁有組織底下";

test("劇本 9:dry-run 分得出 (b) 只列該組織擁有 vs (c) 加列失去子樹支撐;送出 (b) 只解除南港店長", async ({
  page,
  tenant,
}) => {
  const { member, tenantAdmin } = tenant;
  const token = tenantAdmin.token;

  // 步驟 1 前置(api):+user 同屬南港店 + 內湖店;南港店搬到「東區」底下;
  // 另外兩個角色(擁有組織 = 南港店 / 東區)指派給 +user(客服本來就有)
  await addMemberToNeihu(tenant);
  const eastOrgId = await createChildOrg(token, tenant.tenantOrgId, "東區");
  await moveOrg(token, tenant.nangangOrgId, eastOrgId);
  const nangangRoleId = await grantMemberRoleOwnedBy(
    tenant,
    NANGANG_ROLE,
    tenant.nangangOrgId,
  );
  const eastRoleId = await grantMemberRoleOwnedBy(tenant, EAST_ROLE, eastOrgId);

  // 畫面要顯示的清單,先在 api 上對一次:原因逐筆、客服不在裡面、試算不解除任何東西
  const preview = await setUserOrgsWithPolicy(token, {
    userId: member.userId,
    orgIds: [tenant.neihuOrgId],
    dryRun: true,
  });
  expect(
    Object.fromEntries(
      preview.unqualifiedRoles.map((role) => [
        role.roleId,
        new Set(role.reasons),
      ]),
    ),
  ).toEqual({
    [nangangRoleId]: new Set([
      "OWNED_BY_REMOVED_ORG",
      "NO_REMAINING_SUBTREE_SUPPORT",
    ]),
    [eastRoleId]: new Set(["NO_REMAINING_SUBTREE_SUPPORT"]),
  });
  expect(preview.revokedRoleIds).toEqual([]);

  // 步驟 2:+tenant → 使用者管理 → 把 +user 自南港店移除 → 確認彈窗列出 dry-run 清單
  await signIn(page, tenantAdmin.account, tenantAdmin.password);
  await page.goto(USER_MANAGER_ROUTE);
  const row = userRow(page, member.account);
  await expect(row).toContainText(NANGANG_ROLE);
  await expect(row).toContainText(EAST_ROLE);

  const dialog = await removeUserOrgInPicker(page, member.account, "南港店");
  const listed = dialog.getByRole("listitem");
  await expect(listed).toHaveCount(2);
  const nangangItem = listed.filter({ hasText: NANGANG_ROLE });
  const eastItem = listed.filter({ hasText: EAST_ROLE });
  await expect(nangangItem).toContainText(REASON_OWNED);
  await expect(nangangItem).toContainText(REASON_NO_SUPPORT);
  await expect(eastItem).toContainText(REASON_NO_SUPPORT);
  await expect(eastItem).not.toContainText(REASON_OWNED);
  await expect(listed.filter({ hasText: SUPPORT_ROLE })).toHaveCount(0);

  // 步驟 3:在同一份 dry-run 上切三個 radio —— 每一檔的說明列出「這一檔會解除哪些」
  const keepAll = removalOption(dialog, "keepAll");
  const revokeOwned = removalOption(dialog, "revokeOwned");
  const revokeAll = removalOption(dialog, "revokeAll");

  // 預設 (c)(ADR-0003)
  await expect(revokeAll.radio).toBeChecked();
  // (c) 解除所有失去資格的 = 南港店長 + 東區督導
  await expect(revokeAll.label).toContainText(NANGANG_ROLE);
  await expect(revokeAll.label).toContainText(EAST_ROLE);
  // (b) 只解除此組織擁有的 = 只有南港店長
  await revokeOwned.radio.check();
  await expect(revokeOwned.radio).toBeChecked();
  await expect(revokeOwned.label).toContainText(NANGANG_ROLE);
  await expect(revokeOwned.label).not.toContainText(EAST_ROLE);
  // (a) 全部保留 = 不解除任何一筆
  await keepAll.radio.check();
  await expect(keepAll.radio).toBeChecked();
  await expect(keepAll.label).not.toContainText(NANGANG_ROLE);
  await expect(keepAll.label).not.toContainText(EAST_ROLE);
  // 切 radio 不重新試算:清單還是那兩筆
  await expect(listed).toHaveCount(2);

  // 送出 (b):只解除南港店長;東區督導留下、變成組織外;客服不動
  await revokeOwned.radio.check();
  const data = await clickAndReadData(
    dialog.getByRole("button", { name: "確認變更" }),
    "SetUserOrgs",
  );
  expect(data).toMatchObject({
    setUserOrgs: { revokedRoleIds: [nangangRoleId] },
  });
  await expect(dialog).toBeHidden();

  await expect(row.getByText(NANGANG_ROLE, { exact: true })).toHaveCount(0);
  await expect(row).toContainText(EAST_ROLE);
  await expect(row).toContainText(SUPPORT_ROLE);
  // 組織外只有一筆 —— 東區督導(客服有內湖店支撐)
  await expect(row.getByText(OUT_OF_SCOPE_TAG, { exact: true })).toHaveCount(1);
});
