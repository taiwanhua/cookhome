import {
  createWorkflowWorld,
  reassignInBlockedList,
  reviewStep,
  usersOf,
} from "../fixtures/scenario-workflows";
import { expect, test } from "../fixtures/test";
import {
  approveAs,
  formSubmission,
  publishCustomWorkflow,
  setUserEnabled,
  submissionStatus,
  submitForm,
  workflowInstance,
} from "../fixtures/workflow-api";

/**
 * 劇本 22 — 審核者停用 → 阻擋 → 改派 → 完成
 * 正本:`docs/testing/permission-scenarios.md`「劇本 22」。
 * 用哪一頁:流程管理 → 阻擋清單(+tenant,`system.workflows.blocked-page.reassign`)。
 * 前置(走 api):客製流程「主管審核」一關、指定使用者 = 南港店主管;申請人送出;+tenant 停用主管。
 */
test("劇本 22:審核者停用 → 單被阻擋 → 流程管理者在阻擋清單改派 → 新審核者核准完成", async ({
  page,
  tenant,
}) => {
  test.setTimeout(240_000);
  const world = await createWorkflowWorld(tenant, { formName: "病假單" });
  await publishCustomWorkflow(tenant.tenantAdmin.token, {
    key: `leave_${tenant.slug}`,
    name: "請假審核",
    definition: {
      steps: [reviewStep("manager", "主管審核", usersOf(world.manager))],
      edges: null,
    },
    bindFormKey: world.formKey,
  });
  const title = `病假兩天-${tenant.slug}`;
  const submitted = await submitForm(world.applicant.token, world.formKey, {
    title,
    amount: 2,
  });

  // 前置:+tenant 停用主管 → 他的任務失效、這張單被阻擋
  const disabled = await setUserEnabled(
    tenant.tenantAdmin.token,
    world.manager.userId,
    false,
  );
  expect(disabled.errors ?? []).toEqual([]);
  const blocked = await formSubmission(world.applicant.token, submitted.id);
  expect(blocked.status).toBe("REVIEWING");
  expect(blocked.blocked).toBe(true);

  // 步驟 1:+tenant → 阻擋清單 →「改派」→ 選副理 → 確定
  await reassignInBlockedList(page, tenant, title, world.deputy);
  await expect(page.getByText("目前沒有被阻擋的單")).toBeVisible();
  const instance = await workflowInstance(
    world.applicant.token,
    submitted.currentInstanceId ?? "",
  );
  expect(instance.status).toBe("RUNNING");
  expect(instance.steps[0]?.plan[0]?.assignee.id).toBe(world.deputy.userId);
  // 原承辦人記在改派紀錄(`previousAssignees`,曾持有的人仍可讀那個修訂)
  expect(instance.steps[0]?.plan[0]?.previousAssignees).toEqual([
    { id: world.manager.userId },
  ]);

  // 步驟 2:副理核准 → 完成
  await approveAs(world.deputy.token, submitted.id);
  expect(await submissionStatus(world.applicant.token, submitted.id)).toBe(
    "COMPLETED",
  );
});
