import { createDemoItemOne, updateDemoItemOne } from "../fixtures/api";
import {
  SAMPLE_ONE_EDIT_INTERNAL_NOTE,
  SAMPLE_ONE_EDIT_ROUTE,
  SAMPLE_ONE_SHOW_INTERNAL_NOTE,
  SAMPLE_ONE_VIEW_ROUTE,
} from "../fixtures/demo-keys";
import { errorCodeOf, errorReasonOf } from "../fixtures/graphql";
import { expect, test } from "../fixtures/test";
import { signIn } from "../fixtures/ui";

/**
 * 劇本 5 — 欄位級權限(綁父模組)
 * 正本:`docs/testing/permission-scenarios.md`「劇本 5」。
 * 用哪一頁:示範模組1 的詳情頁與編輯頁;帳號:+tenant 改矩陣(這裡走 api)、+user 看畫面。
 *
 * 三態:**沒有 show → 整列 / 整欄不渲染**;**有 show 沒有 edit → 唯讀並附說明**;
 * **兩個都有 → 可編輯**。步驟 4「硬送寫入」照文件由 api 斷言(畫面上驗不到)。
 */

const INTERNAL_NOTE = "內部備註";
const READONLY_HINT = "你看得到內部備註,但沒有修改它的權限。";

test("劇本 5:內部備註的三態(看不到 → 唯讀 → 可編輯),硬送寫入被擋", async ({
  page,
  tenant,
}) => {
  const itemName = `欄位級-${tenant.slug}`;
  const itemId = await createDemoItemOne(tenant.member.token, {
    name: itemName,
    note: "一般備註",
  });
  const viewUrl = `${SAMPLE_ONE_VIEW_ROUTE}/${itemId}`;
  const editUrl = `${SAMPLE_ONE_EDIT_ROUTE}/${itemId}`;

  await signIn(page, tenant.member.account, tenant.member.password);

  // 步驟 1:兩筆內部備註權限都不給 → 詳情頁沒有那一列、編輯頁沒有那個欄位
  await page.goto(viewUrl);
  await expect(page.getByRole("heading", { name: itemName })).toBeVisible();
  await expect(page.getByText("備註", { exact: true })).toBeVisible();
  await expect(page.getByText(INTERNAL_NOTE, { exact: true })).toHaveCount(0);

  await page.goto(editUrl);
  await expect(page.getByLabel("名稱")).toBeVisible();
  await expect(page.getByLabel(INTERNAL_NOTE, { exact: true })).toHaveCount(0);

  // 步驟 4:同一個狀態下硬送 internalNote → FORBIDDEN + reason FIELD_FORBIDDEN
  //(欄位一出現在 input 裡就要權限,送 null 清空也一樣)
  const denied = await updateDemoItemOne(tenant.member.token, {
    id: itemId,
    internalNote: "硬送的內容",
  });
  expect(errorCodeOf(denied)).toBe("FORBIDDEN");
  expect(errorReasonOf(denied)).toBe("FIELD_FORBIDDEN");

  // 步驟 2:只加 show-internal-note → 兩頁都看得到,編輯頁的欄位是唯讀並附說明
  await tenant.setSupportPermissions({
    addPermissions: [SAMPLE_ONE_SHOW_INTERNAL_NOTE],
  });

  await page.goto(viewUrl);
  await expect(page.getByText(INTERNAL_NOTE, { exact: true })).toBeVisible();

  await page.goto(editUrl);
  await expect(page.getByLabel(INTERNAL_NOTE, { exact: true })).toBeDisabled();
  await expect(page.getByText(READONLY_HINT)).toBeVisible();

  // 步驟 3:再加 edit-internal-note → 欄位可編輯,存得下去
  await tenant.setSupportPermissions({
    addPermissions: [
      SAMPLE_ONE_SHOW_INTERNAL_NOTE,
      SAMPLE_ONE_EDIT_INTERNAL_NOTE,
    ],
  });

  await page.goto(editUrl);
  const field = page.getByLabel(INTERNAL_NOTE, { exact: true });
  await expect(field).toBeEnabled();
  await expect(page.getByText(READONLY_HINT)).toHaveCount(0);

  const newNote = `只有客服看得到-${tenant.slug}`;
  await field.fill(newNote);
  await page.getByRole("button", { name: "儲存" }).click();
  // 儲存成功後回列表(`DemoFormPage` 的 onLeave)
  await expect(
    page.getByRole("button", { name: "+ 新增示範項目" }),
  ).toBeVisible();

  await page.goto(viewUrl);
  await expect(page.getByText(newNote)).toBeVisible();
});
