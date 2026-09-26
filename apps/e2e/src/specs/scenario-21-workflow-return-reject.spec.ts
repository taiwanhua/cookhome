import { clickAndWaitForOperation } from "../fixtures/scenario-forms";
import {
  LEAVE_ROUTE,
  createWorkflowWorld,
  decideInUi,
  myApplicationRow,
  openTaskInApplyCenter,
  progressRow,
  reviewStep,
} from "../fixtures/scenario-workflows";
import { expect, test } from "../fixtures/test";
import { pageArea } from "../fixtures/ui";
import {
  formSubmission,
  publishCustomWorkflow,
  submissionStatus,
  submitForm,
} from "../fixtures/workflow-api";

/**
 * 劇本 21 — 退回修改 → 再送 → 駁回
 * 正本:`docs/testing/permission-scenarios.md`「劇本 21」。
 * 用哪一頁:申請中心詳情(審核者退回 / 駁回)、我的申請 → 請假的編輯頁(申請人改完再送)。
 * 前置(走 api):共用表單掛「請假」、客製流程「直屬主管」一關並綁定;申請人送出。
 */
test("劇本 21:退回修改 → 申請人改完再送(修訂 +1、從第一關重審)→ 駁回", async ({
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
  const title = `病假五天-${tenant.slug}`;
  const retitled = `病假四天-${tenant.slug}`;
  const submitted = await submitForm(world.applicant.token, world.formKey, {
    title,
    amount: 5,
  });

  // 步驟 1:主管退回修改(理由必填)
  await openTaskInApplyCenter(page, world.manager, title);
  await decideInUi(page, "退回修改", "天數請改成四天");
  expect(await submissionStatus(world.applicant.token, submitted.id)).toBe(
    "RETURNED",
  );

  // 步驟 2:申請人「我的申請」看到已退回 →「繼續編輯」→ 改標題 → 送出
  const row = await myApplicationRow(page, world.applicant, title);
  await expect(row.getByText("已退回")).toBeVisible();
  await row.getByRole("button", { name: `繼續編輯「${title}」` }).click();
  await page.waitForURL((url) =>
    url.pathname.startsWith(`${LEAVE_ROUTE}/edit-page/`),
  );
  await expect(pageArea(page).getByText(/被退回修改/)).toBeVisible();
  await pageArea(page).getByRole("textbox", { name: "標題" }).fill(retitled);
  await clickAndWaitForOperation(
    page,
    pageArea(page).getByRole("button", { name: "送出" }),
    "SubmitFormSubmission",
  );
  const resubmitted = await formSubmission(world.applicant.token, submitted.id);
  expect(resubmitted.status).toBe("REVIEWING");
  expect(resubmitted.revision).toBe(2);
  expect(resubmitted.currentInstanceId).not.toBe(submitted.currentInstanceId);

  // 步驟 3:主管看到新修訂的標題,從第一關重審 → 駁回(理由必填)
  await openTaskInApplyCenter(page, world.manager, retitled);
  await expect(progressRow(page, "直屬主管", "審核中")).toBeVisible();
  await decideInUi(page, "駁回", "假別不符");

  // 步驟 4:申請人看到已駁回,不能再編輯
  const rejectedRow = await myApplicationRow(page, world.applicant, retitled);
  await expect(rejectedRow.getByText("已駁回")).toBeVisible();
  await expect(
    rejectedRow.getByRole("button", { name: `繼續編輯「${retitled}」` }),
  ).toHaveCount(0);
});
