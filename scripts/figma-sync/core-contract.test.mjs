import assert from "node:assert/strict";
import { test } from "node:test";

import { hashArtifact } from "./artifacts.mjs";
import {
  BASE_FILE,
  BRAND_FILE,
  contract,
  core,
  createScenario,
  createWorld,
  makeHeader,
  planBrandRun,
  selectionsFor,
} from "./test-support.mjs";

const code = (expected) => (error) => {
  assert.equal(error.name, "FigmaSyncError");
  assert.equal(error.code, expected, error.message);
  return true;
};
const clone = (value) => structuredClone(value);
const scenario = await createScenario();
const consumerInventory = await scenario.scanConsumer("contract-scan");

test("raw inventory 不含自我引用的 digest;review 不改寫封存的 inventory", () => {
  for (const slot of consumerInventory.slots) {
    assert.equal(slot.sourceMatch.sourceInventoryDigest, null);
    assert.equal(slot.sourceMatch.consumerInventoryDigest, null);
    assert.equal(slot.sourceMatch.previousReceiptDigest, null);
  }
  const before = contract.digest(consumerInventory);
  const review = scenario.review(consumerInventory);
  assert.equal(contract.digest(consumerInventory), before);
  assert.equal(review.inventoryDigests.consumer, before);
  assert.equal(
    review.inventoryDigests.base,
    contract.digest(scenario.inventories.base),
  );
});

test("contract 由 values / schema / records / graph / review 明示注入組裝;生成碼用同一支 assembleContract", async () => {
  const { CONTRACT_FACTORIES, assembleContract, createContract } =
    await import("./core-contract.mjs");
  assert.deepEqual(Object.keys(CONTRACT_FACTORIES), [
    "createContractValues",
    "createSchemaDefinitions",
    "createSchemaRuntime",
    "createArtifactContract",
    "createGuardValues",
    "createRecordSchema",
    "createRecordChecks",
    "createPlanGraph",
    "createAssetGraphRules",
    "createPlanningValues",
    "createReceiptSchema",
    "createReviewSchema",
    "createIdentityReviewer",
  ]);
  const assembled = assembleContract(CONTRACT_FACTORIES);
  assert.equal(
    assembled.digest(consumerInventory),
    contract.digest(consumerInventory),
  );
  assert.equal(typeof createContract().validateArtifact, "function");
  assert.equal(typeof assembled.createIdentityReview, "function");
  // 注入別的 graph 就真的用它:factory 不偷取 module closure
  const calls = [];
  const probed = assembleContract({
    ...CONTRACT_FACTORIES,
    createPlanGraph: () => ({
      validatePlanGraph: (plan) => calls.push(plan.runId),
    }),
  });
  const run = await scenario.sync("asm-1", { planOnly: true });
  probed.validateArtifact(run.plan);
  assert.deepEqual(calls, ["asm-1"]);
});

test("request 的生命週期:規劃用的 apply request 在 plan 產生前沒有 plan digest;scan 不能帶", async () => {
  const run = await scenario.sync("req-1", { planOnly: true });
  const planning = run.input.request;
  assert.equal(planning.operation, "apply");
  assert.equal(planning.inputDigests.plan, null);
  assert.equal(contract.validateArtifact(planning), planning);
  const applying = {
    ...planning,
    inputDigests: { ...planning.inputDigests, plan: contract.digest(run.plan) },
  };
  assert.equal(contract.validateArtifact(applying), applying);
  const scan = {
    ...planning,
    operation: "scan",
    inputDigests: { ...planning.inputDigests, plan: contract.digest(run.plan) },
  };
  assert.throws(
    () => contract.validateArtifact(scan),
    code("ARTIFACT_INVALID"),
  );
  assert.throws(
    () =>
      contract.validateArtifact({
        ...planning,
        target: { ...planning.target, rootNodeIds: [] },
      }),
    code("ARTIFACT_INVALID"),
  );
});

test("attempt 內嵌的 afterInventory 必須與 attempt 同一輪 run / project / tool", async () => {
  const other = await createScenario();
  const run = await other.sync("emb-1");
  assert.equal(contract.validateArtifact(run.attempt), run.attempt);
  for (const change of [
    (after) => (after.runId = "another-run"),
    (after) => (after.project.slug = "other-project"),
    (after) => (after.tool.gitCommit = "c".repeat(40)),
    (after) => (after.kind = "plan"),
  ]) {
    const spliced = JSON.parse(JSON.stringify(run.attempt));
    change(spliced.afterInventory);
    assert.throws(
      () => contract.validateArtifact(spliced),
      code("ARTIFACT_INVALID"),
    );
  }
  assert.equal(
    contract.sameHeader(run.attempt, run.attempt.afterInventory),
    true,
  );
  assert.equal(contract.sameHeader(run.attempt, run.plan), true);
});
