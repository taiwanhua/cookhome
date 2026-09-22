import type { Page } from "@playwright/test";

import { roleMatrix } from "../fixtures/api";
import {
  EDIT_PAGE_SHOW_HISTORY,
  EDIT_PAGE_WILDCARD,
  ROLE_MANAGER_ROUTE,
  SAMPLE_ONE,
  SAMPLE_ONE_CREATE,
  SAMPLE_ONE_DELETE,
  SAMPLE_ONE_EDIT,
  SAMPLE_ONE_EDIT_INTERNAL_NOTE,
  SAMPLE_ONE_SHOW_INTERNAL_NOTE,
  SAMPLE_ONE_VIEW,
  SAMPLE_ONE_WILDCARD,
} from "../fixtures/demo-keys";
import { expect, test } from "../fixtures/test";
import { matrixCheckbox, matrixRow, signIn } from "../fixtures/ui";

/**
 * 劇本 1 — wildcard 涵蓋未來(同層)
 * 正本:`docs/testing/permission-scenarios.md`「劇本 1」。用哪一頁:角色管理 →「權限設定」;帳號:+tenant。
 *
 * 跨版本的那半條(「下一版 seed 新增權限即擁有」)不在這裡,由 api 測試覆蓋
 * (`apps/api/src/permission/permission.test.ts`)。
 */

/** 示範模組1 自己這一層的個別權限。 */
const SAME_LEVEL = [
  SAMPLE_ONE_VIEW,
  SAMPLE_ONE_CREATE,
  SAMPLE_ONE_EDIT,
  SAMPLE_ONE_DELETE,
  SAMPLE_ONE_SHOW_INTERNAL_NOTE,
  SAMPLE_ONE_EDIT_INTERNAL_NOTE,
];

const openSupportMatrix = async (page: Page) => {
  await page.goto(ROLE_MANAGER_ROUTE);
  await page.getByText("客服", { exact: true }).click();
  await expect(matrixRow(page, SAMPLE_ONE)).toBeVisible();
};

test("劇本 1:勾示範模組1 的「全部(*)」只連動同層,子模組(編輯頁)不受影響", async ({
  page,
  tenant,
}) => {
  await signIn(page, tenant.tenantAdmin.account, tenant.tenantAdmin.password);
  await openSupportMatrix(page);

  // 前置給的是四個動作,wildcard 本身還沒勾
  await expect(matrixCheckbox(page, SAMPLE_ONE_WILDCARD)).not.toBeChecked();
  await expect(
    matrixCheckbox(page, SAMPLE_ONE_SHOW_INTERNAL_NOTE),
  ).not.toBeChecked();

  // 步驟 1:勾「全部(*)」→ 同層的 view / create / edit / delete / 內部備註兩筆一起被勾起
  await matrixCheckbox(page, SAMPLE_ONE_WILDCARD).check();
  for (const key of SAME_LEVEL) {
    await expect(matrixCheckbox(page, key)).toBeChecked();
  }

  // 步驟 2:編輯頁節點的「全部(*)」與 show-history **沒有**被勾起來(子模組由自己的 `*` 代表)
  await expect(matrixCheckbox(page, EDIT_PAGE_WILDCARD)).not.toBeChecked();
  await expect(matrixCheckbox(page, EDIT_PAGE_SHOW_HISTORY)).not.toBeChecked();

  // 步驟 3:儲存、重新進入 → 勾選狀態一致
  const save = page.getByRole("button", { name: "儲存變更" });
  await save.click();
  await expect(save).toBeDisabled();

  await openSupportMatrix(page);
  await expect(matrixCheckbox(page, SAMPLE_ONE_WILDCARD)).toBeChecked();
  for (const key of SAME_LEVEL) {
    await expect(matrixCheckbox(page, key)).toBeChecked();
  }
  await expect(matrixCheckbox(page, EDIT_PAGE_WILDCARD)).not.toBeChecked();
  await expect(matrixCheckbox(page, EDIT_PAGE_SHOW_HISTORY)).not.toBeChecked();

  // 預期最後一句:「資料庫只存一筆 `demo.sub.sample-one.*`」—— UI 看不到筆數,
  // 改問 api:授予裡有同層的 `*`,而編輯頁那一層一筆都沒有。
  const { granted } = await roleMatrix(
    tenant.tenantAdmin.token,
    tenant.supportRoleId,
  );
  expect(granted.permissionKeys).toContain(SAMPLE_ONE_WILDCARD);
  expect(granted.permissionKeys).not.toContain(EDIT_PAGE_WILDCARD);
  expect(granted.permissionKeys).not.toContain(EDIT_PAGE_SHOW_HISTORY);
});
