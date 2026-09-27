import { clickAndWaitForOperation } from "../fixtures/scenario-forms";
import {
  LEAVE_ROUTE,
  createWorkflowWorld,
  reviewStep,
} from "../fixtures/scenario-workflows";
import { expect, test } from "../fixtures/test";
import { pageArea, signInAgain } from "../fixtures/ui";
import {
  approveAs,
  formSubmission,
  publishCustomWorkflow,
  submissionStatus,
  submitForm,
  taskSubmissionIds,
} from "../fixtures/workflow-api";

/**
 * 劇本 23 — 核准後作廢 → 複製為新單 → 重審
 * 正本:`docs/testing/permission-scenarios.md`「劇本 23」。
 * 用哪一頁:請假列表(「作廢」)、請假詳情(審核區塊「複製為新單」)、請假編輯頁(送出)。
 * 前置(走 api):客製流程「直屬主管」一關並綁定;申請人送出、主管核准。
 */
test("劇本 23:綁流程的已完成單只能作廢;作廢後複製為新單、送出重新審核", async ({
  page,
  tenant,
}) => {
  test.setTimeout(240_000);
  const world = await createWorkflowWorld(tenant, { formName: "病假單" });
  await publishCustomWorkflow(tenant.tenantAdmin.token, {
    key: `leave_${tenant.slug}`,
    name: "請假審核",
    definition: {
      steps: [reviewStep("manager", "直屬主管", { kind: "manager", level: 1 })],
      edges: null,
    },
    bindFormKey: world.formKey,
  });
  const title = `病假一天-${tenant.slug}`;
  const submitted = await submitForm(world.applicant.token, world.formKey, {
    title,
    amount: 1,
  });
  await approveAs(world.manager.token, submitted.id);
  expect(await submissionStatus(world.applicant.token, submitted.id)).toBe(
    "COMPLETED",
  );

  // 步驟 1:申請人 → 請假列表:已完成的單沒有「編輯」,只有「作廢」
  await signInAgain(page, world.applicant.account, world.applicant.password);
  await page.goto(LEAVE_ROUTE);
  const row = pageArea(page).getByRole("row").filter({ hasText: title });
  await expect(row.getByText("已完成")).toBeVisible();
  await expect(
    row.getByRole("button", { name: `編輯「${title}」` }),
  ).toHaveCount(0);

  // 步驟 2:作廢(理由必填)
  await row.getByRole("button", { name: `作廢「${title}」` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "作廢理由" }).fill("日期填錯");
  await clickAndWaitForOperation(
    page,
    dialog.getByRole("button", { name: "作廢", exact: true }),
    "VoidSubmission",
  );
  await expect(row.getByText("已作廢")).toBeVisible();

  // 步驟 3:詳情 → 審核區塊「複製為新單」→ 進編輯頁(新草稿)→ 送出
  await row.getByRole("button", { name: `檢視「${title}」` }).click();
  await clickAndWaitForOperation(
    page,
    pageArea(page).getByRole("button", { name: "複製為新單" }),
    "CopySubmissionToDraft",
  );
  await page.waitForURL((url) =>
    url.pathname.startsWith(`${LEAVE_ROUTE}/edit-page/`),
  );
  const copiedId = page.url().split("/").at(-1) ?? "";
  expect(copiedId).not.toBe(submitted.id);
  await clickAndWaitForOperation(
    page,
    pageArea(page).getByRole("button", { name: "送出" }),
    "SubmitFormSubmission",
  );

  // 步驟 4:新單重新走流程(主管收到新任務),核准後完成;原單維持已作廢、記著新單
  const copied = await formSubmission(world.applicant.token, copiedId);
  expect(copied.status).toBe("REVIEWING");
  expect(copied.copiedFrom).toBe(submitted.id);
  expect(await taskSubmissionIds(world.manager.token)).toContain(copiedId);
  await approveAs(world.manager.token, copiedId);
  expect(await submissionStatus(world.applicant.token, copiedId)).toBe(
    "COMPLETED",
  );
  const source = await formSubmission(world.applicant.token, submitted.id);
  expect(source.status).toBe("VOIDED");
  expect(source.replacedById).toBe(copiedId);
});
