import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildExecutionSource,
  buildReadonlyTransportSource,
} from "./execution-source.mjs";
import {
  contract,
  core,
  createFakeFigma,
  createScenario,
  executeSource,
} from "./test-support.mjs";
import { createNodeTransport } from "./transport-codec.mjs";

const resolution = (inventory, decision, nodeId = "10:7") => {
  const slot = inventory.slots.find((slot) => slot.locator.nodeId === nodeId);
  return {
    locator: slot.locator,
    consumerInventoryDigest: contract.digest(inventory),
    before: slot.value,
    sourceMatchDigest: contract.digest(slot.sourceMatch),
    decision,
    expectedRole: decision === "adopt-source" ? "main" : null,
  };
};

test("局部計畫只帶本次管理狀態,成功記錄仍逐欄保留大量其他範圍的歷史", async () => {
  const scenario = await createScenario();
  const first = await scenario.sync("scoped-first");
  const prior = structuredClone(first.verdict.receipt);
  const beforeRelease = await scenario.scanConsumer("release-history", [
    "10:7",
  ]);
  const release = await scenario.sync("release-history", {
    inventory: beforeRelease,
    previousReceipt: prior,
    identityReview: scenario.review(beforeRelease, [
      resolution(beforeRelease, "preserve-project"),
    ]),
    planOnly: true,
  });
  for (let index = 0; index < 1000; index += 1) {
    const slot = structuredClone(prior.managedSlots[0]);
    slot.locator.nodeId = `history:${index}`;
    slot.locator.rootInstanceId = `history-root:${index}`;
    slot.scopeEvidence = {
      pageId: "history-page",
      scopeRootId: `history-root:${index}`,
      ancestorIds: [`history-root:${index}`, "history-page"],
    };
    prior.managedSlots.push(slot);
    const released = structuredClone(release.plan.releasedSlots[0]);
    released.locator.nodeId = `released-history:${index}`;
    released.scopeEvidence = slot.scopeEvidence;
    prior.releasedSlots.push(released);
  }
  const next = await scenario.sync("scoped-next", {
    roots: ["10:7"],
    previousReceipt: prior,
  });
  assert.equal(next.verdict.status, "verified");
  assert.equal(next.plan.managedSlots.length, 1);
  assert.equal(next.plan.releasedSlots.length, 0);
  assert.equal(
    next.verdict.receipt.managedSlots.length,
    prior.managedSlots.length,
  );
  assert.deepEqual(next.verdict.receipt.releasedSlots, prior.releasedSlots);
  const persisted = new Map(
    next.verdict.receipt.managedSlots.map((slot) => [
      contract.slotKey(slot.locator),
      slot,
    ]),
  );
  for (const slot of prior.managedSlots) {
    if (slot.locator.nodeId === "10:7") continue;
    assert.deepEqual(persisted.get(contract.slotKey(slot.locator)), slot);
  }
  const request = {
    ...next.input.request,
    inputDigests: {
      ...next.input.request.inputDigests,
      plan: contract.digest(next.plan),
    },
  };
  const source = buildExecutionSource({ request, plan: next.plan });
  assert.ok(source.length <= 50000);
  const figma = () => createFakeFigma(scenario.world, next.plan.scope.fileKey);
  const head = await executeSource(source, figma());
  const chunks = [];
  for (let index = 0; index < (head.payload?.chunkCount ?? 0); index += 1) {
    chunks.push(
      await executeSource(
        buildReadonlyTransportSource({ request, head, index }),
        figma(),
      ),
    );
  }
  const attempt = createNodeTransport().assemble(request, head, chunks);
  const verdict = core.verifySync({
    plan: next.plan,
    attempt,
    beforeInventory: next.inventory,
    afterInventory: attempt.afterInventory,
    previousReceipt: prior,
  });
  assert.equal(verdict.status, "verified");
  assert.deepEqual(
    verdict.receipt.managedSlots,
    next.verdict.receipt.managedSlots,
  );
  assert.deepEqual(verdict.receipt.releasedSlots, prior.releasedSlots);
});

test("局部釋出經其他範圍同步仍保留,回到原範圍只有明示採來源才重新收管", async () => {
  const scenario = await createScenario();
  const first = await scenario.sync("release-first");
  const inventory = await scenario.scanConsumer("release-scan", ["10:2"]);
  const released = await scenario.sync("release-local", {
    inventory,
    previousReceipt: first.verdict.receipt,
    identityReview: scenario.review(inventory, [
      resolution(inventory, "preserve-project", "10:2"),
    ]),
  });
  assert.equal(released.verdict.status, "verified");
  assert.equal(released.plan.releasedSlots.length, 1);
  const elsewhere = await scenario.sync("release-elsewhere", {
    roots: ["10:7"],
    previousReceipt: released.verdict.receipt,
  });
  assert.equal(elsewhere.verdict.status, "verified");
  assert.equal(elsewhere.plan.releasedSlots.length, 0);
  assert.deepEqual(
    elsewhere.verdict.receipt.releasedSlots,
    released.verdict.receipt.releasedSlots,
  );
  const back = await scenario.sync("release-back", {
    roots: ["10:2"],
    previousReceipt: elsewhere.verdict.receipt,
  });
  assert.equal(back.verdict.status, "verified");
  assert.ok(
    !back.plan.managedSlots.some(
      (slot) =>
        slot.locator.nodeId === "10:2" && slot.locator.field === "fill-color",
    ),
  );
  assert.equal(back.plan.actions.length, 0);
  assert.deepEqual(
    back.verdict.receipt.releasedSlots,
    released.verdict.receipt.releasedSlots,
  );
  const adoptedInventory = await scenario.scanConsumer("adopt-scan", ["10:2"]);
  const adopted = await scenario.sync("adopt-local", {
    inventory: adoptedInventory,
    previousReceipt: back.verdict.receipt,
    identityReview: scenario.review(adoptedInventory, [
      resolution(adoptedInventory, "adopt-source", "10:2"),
    ]),
  });
  assert.equal(adopted.verdict.status, "verified");
  assert.equal(adopted.verdict.receipt.releasedSlots.length, 0);
  assert.equal(
    adopted.verdict.receipt.managedSlots.length,
    first.verdict.receipt.managedSlots.length,
  );
});

test("計畫不能略掉本次範圍的既有 ownership,也不能更改範圍外的舊記錄", async () => {
  const scenario = await createScenario();
  const first = await scenario.sync("scope-guard-first");
  const prior = first.verdict.receipt;
  const next = await scenario.sync("scope-guard-next", {
    roots: ["10:7"],
    previousReceipt: prior,
  });
  const verify = (change) => {
    const plan = structuredClone(next.plan);
    change(plan);
    const attempt = structuredClone(next.attempt);
    attempt.planDigest = contract.digest(plan);
    return core.verifySync({
      plan,
      attempt,
      beforeInventory: next.inventory,
      afterInventory: attempt.afterInventory,
      previousReceipt: prior,
    });
  };
  const missing = verify((plan) => {
    plan.managedSlots = [];
  });
  assert.equal(missing.status, "failed");
  assert.ok(
    missing.verification.errors.some(
      (error) => error.code === "OWNERSHIP_STATE_MISSING",
    ),
  );
  const changed = verify((plan) => {
    const outside = structuredClone(
      prior.managedSlots.find((slot) => slot.locator.nodeId !== "10:7"),
    );
    outside.role = "darker";
    plan.managedSlots.push(outside);
  });
  assert.equal(changed.status, "failed");
  assert.ok(
    changed.verification.errors.some(
      (error) => error.code === "OUTSIDE_OWNERSHIP_CHANGED",
    ),
  );
});
