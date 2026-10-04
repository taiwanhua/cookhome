import assert from "node:assert/strict";
import { test } from "node:test";

import { createRuntime } from "./runtime.mjs";
import {
  BASE_FILE,
  CONSUMER_FILE,
  contract,
  createFakeFigma,
  createScenario,
  makeRequest,
} from "./test-support.mjs";

const scanRequest = (runId = "rt-scan") =>
  makeRequest({
    targetKind: "consumer",
    fileKey: CONSUMER_FILE,
    roots: ["10:1"],
    runId,
  });
/** 規劃完成、尚未執行的 apply 輸入。 */
async function plannedApply(runId, options) {
  const scenario = await createScenario();
  const planned = await scenario.sync(runId, { planOnly: true, ...options });
  const request = {
    ...planned.input.request,
    inputDigests: {
      ...planned.input.request.inputDigests,
      plan: contract.digest(planned.plan),
    },
  };
  scenario.world.resetLog();
  return { scenario, plan: planned.plan, request };
}

test("scan:fileKey 不可讀或不符 → 帶 issue 的空 inventory,不掃描、不以 request 回填", async () => {
  const scenario = await createScenario();
  scenario.world.resetLog();
  for (const [fileKey, issue] of [
    [null, "FILE_KEY_UNREADABLE"],
    [undefined, "FILE_KEY_UNREADABLE"],
    [BASE_FILE, "FILE_KEY_MISMATCH"],
  ]) {
    const figma = createFakeFigma(scenario.world, CONSUMER_FILE, { fileKey });
    const inventory = await createRuntime(figma).scanScope(scanRequest());
    assert.equal(inventory.kind, "inventory");
    assert.equal(inventory.observedFileKey, fileKey ?? null);
    assert.equal(inventory.capabilities.fileKeyReadable, Boolean(fileKey));
    assert.deepEqual(
      inventory.issues.map((item) => item.code),
      [issue],
    );
    assert.deepEqual(inventory.slots, []);
    assert.equal(inventory.coverage.nodes, 0);
  }
  assert.equal(scenario.world.mutations.length, 0);
});

test("apply:fileKey 不可讀或不符 → failed,任何 import / mutation 之前就停", async () => {
  for (const [fileKey, expected] of [
    [null, "FILE_KEY_UNREADABLE"],
    [BASE_FILE, "FILE_KEY_MISMATCH"],
  ]) {
    const { scenario, plan, request } = await plannedApply("rt-1");
    const figma = createFakeFigma(scenario.world, CONSUMER_FILE, { fileKey });
    const attempt = await createRuntime(figma).applyPlan(request, plan);
    assert.equal(attempt.kind, "attempt");
    assert.equal(attempt.status, "failed");
    assert.equal(attempt.observedFileKey, fileKey);
    assert.deepEqual(
      attempt.errors.map((error) => error.code),
      [expected],
    );
    assert.deepEqual(attempt.completedActions, []);
    assert.equal(attempt.afterInventory, null);
    assert.equal(scenario.world.mutations.length, 0);
  }
});

test("apply 回傳的 attempt 內嵌實際 afterInventory;afterInventoryDigest 留給 record 計算", async () => {
  const { scenario, plan, request } = await plannedApply("rt-2");
  const figma = createFakeFigma(scenario.world, CONSUMER_FILE);
  const attempt = await createRuntime(figma).applyPlan(request, plan);
  assert.equal(attempt.status, "applied");
  assert.equal(attempt.runId, "rt-2");
  assert.equal(attempt.planDigest, contract.digest(plan));
  assert.equal(attempt.afterInventoryDigest, null);
  assert.equal(attempt.completedActions.length, plan.actions.length);
  const after = attempt.afterInventory;
  assert.equal(after.kind, "inventory");
  assert.equal(after.observedFileKey, CONSUMER_FILE);
  assert.deepEqual(after.scope, plan.scope);
  // after 是寫入後重新掃描的實際狀態,不是回填 plan 的 expectedAfter
  const rescan = await scenario.scanConsumer("rt-2");
  assert.deepEqual(after.slots, rescan.slots);
  assert.deepEqual(after.coverage, rescan.coverage);
  for (const action of plan.actions) {
    const slot = after.slots.find(
      (item) =>
        contract.slotKey(item.locator) === contract.slotKey(action.locator),
    );
    assert.equal(slot.value.key, action.expectedAfter.key);
  }
});

test("noop:零 import、零寫入,仍回完整 afterInventory", async () => {
  const scenario = await createScenario();
  const first = await scenario.sync("rt-3");
  scenario.world.resetLog();
  const second = await scenario.sync("rt-4", {
    previousReceipt: first.verdict.receipt,
  });
  assert.equal(second.plan.status, "noop");
  assert.equal(second.attempt.status, "applied");
  assert.deepEqual(second.attempt.completedActions, []);
  assert.equal(scenario.world.mutations.length, 0);
  assert.equal(
    second.attempt.afterInventory.slots.length,
    second.inventory.slots.length,
  );
});

test("blocked plan 不能執行;入口只接受協定 request 與對應的 plan", async () => {
  const scenario = await createScenario();
  scenario.consumer.nodes.button.fills = [
    scenario.consumer.nodes.button.fills[0],
    scenario.consumer.nodes.button.fills[0],
  ];
  const planned = await scenario.sync("rt-5", { planOnly: true });
  assert.equal(planned.plan.status, "blocked");
  const request = {
    ...planned.input.request,
    inputDigests: {
      ...planned.input.request.inputDigests,
      plan: contract.digest(planned.plan),
    },
  };
  scenario.world.resetLog();
  const runtime = createRuntime(createFakeFigma(scenario.world, CONSUMER_FILE));
  const attempt = await runtime.applyPlan(request, planned.plan);
  assert.equal(attempt.status, "failed");
  assert.equal(attempt.errors[0].code, "PLAN_BLOCKED");
  assert.equal(scenario.world.mutations.length, 0);

  await assert.rejects(
    runtime.scanScope(planned.plan),
    /ARTIFACT_KIND_MISMATCH/,
  );
  await assert.rejects(
    runtime.applyPlan(scanRequest(), planned.plan),
    /REQUEST_OPERATION_INVALID/,
  );
  await assert.rejects(
    runtime.applyPlan(request, null),
    /REQUEST_OPERATION_INVALID/,
  );
  // request 與 plan 不是同一輪
  const other = await runtime.applyPlan(
    { ...request, runId: "someone-else" },
    planned.plan,
  );
  assert.equal(other.errors[0].code, "REQUEST_PLAN_MISMATCH");
  assert.equal(scenario.world.mutations.length, 0);
});
