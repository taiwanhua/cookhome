import {
  createDemoItemOne,
  demoItemOneHistory,
  updateDemoItemOne,
} from "../fixtures/api";
import {
  EDIT_PAGE_SHOW_HISTORY,
  SAMPLE_ONE_EDIT_INTERNAL_NOTE,
  SAMPLE_ONE_EDIT_ROUTE,
  SAMPLE_ONE_SHOW_INTERNAL_NOTE,
  SAMPLE_ONE_VIEW_ROUTE,
} from "../fixtures/demo-keys";
import { errorCodeOf, errorReasonOf } from "../fixtures/graphql";
import { expect, test } from "../fixtures/test";
import { pageArea, signIn } from "../fixtures/ui";

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
const HISTORY_REGION = "變更歷程";
const REDACTED = "[redacted]";

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

  // 順手一起看(文件「劇本 5」末節):把內部備註的兩筆權限收回、只給 `edit-page.show-history`
  // —— 這就是「沒有讀的權限、卻有看變更歷程的權限」那個人。歷程區塊看得到,
  // 但剛剛那次變更的內容在歷程裡一律是 `[redacted]`,不會從側門外洩(ADR-0004)。
  await tenant.setSupportPermissions({
    addPermissions: [EDIT_PAGE_SHOW_HISTORY],
  });

  await page.goto(editUrl);
  await expect(page.getByLabel(INTERNAL_NOTE, { exact: true })).toHaveCount(0);
  await expect(
    pageArea(page).getByRole("region", { name: HISTORY_REGION }),
  ).toBeVisible();

  // 區塊本身只列「誰、什麼時候、做了什麼」,值根本不渲染 ——
  // 所以「值有沒有被遮」只問得到 api(`demoItemOneHistory` 需 `edit-page.show-history`)
  const entries = await demoItemOneHistory(tenant.member.token, itemId);
  const edited = entries.find((entry) => entry.action.endsWith(".edit"));
  expect(edited?.after?.internalNote).toBe(REDACTED);
  expect(JSON.stringify(entries)).not.toContain(newNote);
});
