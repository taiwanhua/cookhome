import {
  createWorkflowWorld,
  decideInUi,
  extraPerson,
  openInstanceDetail,
  openTaskInApplyCenter,
  progressRow,
  reassignInBlockedList,
  reviewStep,
  usersOf,
} from "../fixtures/scenario-workflows";
import { expect, test } from "../fixtures/test";
import {
  approveAs,
  myTasksOnInstance,
  publishCustomWorkflow,
  setUserEnabled,
  submissionStatus,
  submitForm,
  taskSubmissionIds,
  workflowInstance,
} from "../fixtures/workflow-api";

/**
 * 劇本 24 — 採購單三部門平行:一條阻擋改派、全部通過後匯合核定
 * 正本:`docs/testing/permission-scenarios.md`「劇本 24」。
 * 用哪一頁:阻擋清單(+tenant 改派採購那條)、申請中心詳情(原部門確認:看分支進度、核准)。
 * 前置(走 api):客製流程「原部門初審 → 財務(兩人 any)/ 法務(兩人 all)/ 採購 → 三部門匯合 → 原部門確認」
 * 並綁定;申請人送出、原部門初審核准;+tenant 停用採購承辦人;財務與法務核准。
 */
test("劇本 24:三部門平行審核,採購那條阻擋改派;全部通過後匯合,原部門確認核定", async ({
  page,
  tenant,
}) => {
  test.setTimeout(300_000);
  const world = await createWorkflowWorld(tenant, {
    formName: "採購單",
    numberLabel: "金額",
    extra: {
      own: "原部門主任",
      fin1: "財務小陳",
      fin2: "財務小林",
      leg1: "法務小張",
      leg2: "法務小王",
      pur1: "採購小李",
      pur2: "採購小吳",
    },
  });
  const own = extraPerson(world, "own");
  const fin1 = extraPerson(world, "fin1");
  const fin2 = extraPerson(world, "fin2");
  const leg1 = extraPerson(world, "leg1");
  const leg2 = extraPerson(world, "leg2");
  const pur1 = extraPerson(world, "pur1");
  const pur2 = extraPerson(world, "pur2");
  await publishCustomWorkflow(tenant.tenantAdmin.token, {
    key: `purchase_${tenant.slug}`,
    name: "採購審核",
    definition: {
      steps: [
        reviewStep("review", "原部門初審", usersOf(own)),
        reviewStep("finance", "財務部審核", usersOf(fin1, fin2)),
        reviewStep("legal", "法務部審核", usersOf(leg1, leg2), { mode: "all" }),
        reviewStep("purchase", "採購部審核", usersOf(pur1)),
        { key: "merge", name: "三部門匯合", kind: "join" },
        reviewStep("confirm", "原部門確認", usersOf(own)),
      ],
      edges: [
        { from: "review", to: "finance" },
        { from: "review", to: "legal" },
        { from: "review", to: "purchase" },
        { from: "finance", to: "merge" },
        { from: "legal", to: "merge" },
        { from: "purchase", to: "merge" },
        { from: "merge", to: "confirm" },
      ],
    },
    bindFormKey: world.formKey,
  });
  const title = `採購筆電-${tenant.slug}`;
  const submitted = await submitForm(world.applicant.token, world.formKey, {
    title,
    amount: 60_000,
  });
  const instanceId = submitted.currentInstanceId ?? "";

  // 前置:原部門初審核准 → 三條分支同時派任
  await approveAs(own.token, submitted.id);
  for (const person of [fin1, fin2, leg1, leg2, pur1]) {
    expect(await taskSubmissionIds(person.token)).toContain(submitted.id);
  }

  // 前置:採購承辦人被停用 → 只有採購那條阻擋;財務(any 一人)與法務(all 兩人)照審
  await setUserEnabled(tenant.tenantAdmin.token, pur1.userId, false);
  await approveAs(fin1.token, submitted.id);
  await approveAs(leg1.token, submitted.id);
  await approveAs(leg2.token, submitted.id);
  const waiting = await workflowInstance(world.applicant.token, instanceId);
  expect(waiting.status).toBe("BLOCKED");
  expect(waiting.activeStepKeys).toEqual(["purchase"]);
  // 財務是 any:一人核准就過,第二人的任務取消(不是待處理)
  expect(await myTasksOnInstance(fin2.token, instanceId)).toEqual([
    expect.objectContaining({ status: "CANCELLED" }),
  ]);
  // 阻擋期間詳情頁的分支進度:財務 / 法務已通過、採購待處理、匯合還在等
  await openInstanceDetail(page, world.applicant, instanceId);
  await expect(progressRow(page, "財務部審核", "已通過")).toBeVisible();
  await expect(progressRow(page, "法務部審核", "已通過")).toBeVisible();
  await expect(progressRow(page, "採購部審核", "待處理")).toBeVisible();
  await expect(progressRow(page, "三部門匯合", "等待所有分支")).toBeVisible();

  // 步驟 1:+tenant 在阻擋清單把採購的任務改派給另一位採購 → 他核准 → 三條都通過、匯合
  await reassignInBlockedList(page, tenant, title, pur2);
  await approveAs(pur2.token, submitted.id);
  const merged = await workflowInstance(world.applicant.token, instanceId);
  expect(merged.activeStepKeys).toEqual(["confirm"]);

  // 步驟 2:原部門主任打開詳情:分支進度一目了然 → 核准(與初審是不同關卡、各自一個任務)
  await openTaskInApplyCenter(page, own, title);
  await expect(progressRow(page, "財務部審核", "已通過")).toBeVisible();
  await expect(progressRow(page, "法務部審核", "已通過")).toBeVisible();
  await expect(progressRow(page, "採購部審核", "已通過")).toBeVisible();
  await expect(progressRow(page, "三部門匯合", "已匯合")).toBeVisible();
  await expect(progressRow(page, "原部門確認", "審核中")).toBeVisible();
  await decideInUi(page, "核准");
  await expect(progressRow(page, "原部門確認", "已通過")).toBeVisible();
  expect(await submissionStatus(world.applicant.token, submitted.id)).toBe(
    "COMPLETED",
  );
});
