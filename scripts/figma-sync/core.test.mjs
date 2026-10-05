import assert from "node:assert/strict";
import { test } from "node:test";

import { createContract } from "./core-contract.mjs";
import { createSyncCore } from "./core.mjs";
import {
  BASE_FILE,
  contract,
  core,
  createScenario,
  makeRequest,
} from "./test-support.mjs";

const code = (expected) => (error) => {
  assert.equal(error.code, expected, error.message);
  return true;
};
const scenario = await createScenario();
const planned = await scenario.sync("c1", { planOnly: true });

test("core 只提供五個固定入口,parts 由參數注入", () => {
  assert.deepEqual(Object.keys(core), [
    "validateArtifact",
    "createIdentityReview",
    "planSync",
    "verifySync",
    "reconcileInterruptedPlan",
  ]);
  // planSync 依 targetKind 分派到注入的 planner,不自行取得 module closure
  const calls = [];
  const local = createContract();
  const probe = createSyncCore({
    contract: local,
    consumerPlanner: {
      planConsumer: (input) => calls.push(["consumer", input]),
    },
    brandPlanner: { planBrand: (input) => calls.push(["brand", input]) },
    verifier: { verifySync: () => "verified-by-part" },
    recovery: { reconcileInterruptedPlan: () => "reconciled-by-part" },
  });
  probe.planSync(planned.input);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "consumer");
  assert.equal(calls[0][1].reconciliation, null);
  const brand = scenario.inventories.brand;
  probe.planSync({
    request: makeRequest({
      operation: "apply",
      targetKind: "brand-library",
      fileKey: brand.observedFileKey,
      roots: brand.scope.rootNodeIds,
      runId: "c2",
      inputDigests: { inventories: [contract.digest(brand)] },
    }),
    inventories: { brand },
  });
  assert.equal(calls[1][0], "brand");
});

test("planSync:輸入與 request 記錄的 digest 必須一致", () => {
  const { input } = planned;
  const withDigests = (change) => {
    const inputDigests = structuredClone(input.request.inputDigests);
    change(inputDigests);
    return { ...input, request: { ...input.request, inputDigests } };
  };
  assert.throws(
    () => core.planSync(withDigests((d) => d.inventories.reverse())),
    code("INPUT_DIGEST_MISMATCH"),
  );
  assert.throws(
    () =>
      core.planSync(withDigests((d) => (d.identityReview = d.inventories[0]))),
    code("INPUT_DIGEST_MISMATCH"),
  );
  assert.throws(
    () =>
      core.planSync(withDigests((d) => (d.previousReceipt = d.inventories[0]))),
    code("INPUT_DIGEST_MISMATCH"),
  );
});

test("planSync:base-library 不可規劃、輸入 kind 與專案來源都要相符", () => {
  const { input } = planned;
  assert.throws(
    () =>
      core.planSync({
        ...input,
        request: { ...input.request, targetKind: "base-library" },
      }),
    code("TARGET_NOT_PLANNABLE"),
  );
  assert.throws(
    () =>
      core.planSync({
        ...input,
        request: { ...input.request, operation: "scan" },
      }),
    code("REQUEST_OPERATION_INVALID"),
  );
  assert.throws(
    () => core.planSync({ ...input, identityReview: input.inventories.base }),
    code("ARTIFACT_KIND_MISMATCH"),
  );
  // 別的專案產出的 artifact 不能混進本專案的規劃
  const foreign = {
    ...input.request,
    project: { ...input.request.project, repository: "other/repo" },
  };
  assert.throws(
    () => core.planSync({ ...input, request: foreign }),
    code("PROJECT_MISMATCH"),
  );
});

test("既有 review 的 inventory digest 不符時拒絕(REVIEW_STALE)", async () => {
  const other = await createScenario();
  other.consumer.nodes.button.visible = false;
  const stale = await other.scanConsumer("other-scan");
  const review = other.review(stale);
  const fresh = await other.scanConsumer("fresh-scan");
  other.consumer.nodes.button.visible = true;
  const changed = await other.scanConsumer("changed-scan");
  assert.notEqual(contract.digest(changed), contract.digest(stale));
  await assert.rejects(
    other.sync("c3", {
      inventory: changed,
      identityReview: review,
      planOnly: true,
    }),
    code("REVIEW_STALE"),
  );
  assert.ok(fresh);
  // 不含 consumer 的 review 不綁特定 consumer 掃描
  const reusable = await other.sync("c4", {
    inventory: changed,
    planOnly: true,
  });
  assert.equal(reusable.plan.status, "ready");
  // 底座 inventory 換了一份(新掃描)→ 需要新的 identity-review
  const { scan } = await import("./test-support.mjs");
  const rescanned = await scan(
    other.world,
    "base-library",
    BASE_FILE,
    [other.base.page.id],
    "scan-base-again",
  );
  const request = {
    ...reusable.input.request,
    inputDigests: {
      ...reusable.input.request.inputDigests,
      inventories: [rescanned, other.inventories.brand, changed].map((item) =>
        contract.digest(item),
      ),
    },
  };
  assert.throws(
    () =>
      core.planSync({
        ...reusable.input,
        request,
        inventories: { ...reusable.input.inventories, base: rescanned },
      }),
    code("REVIEW_STALE"),
  );
});

test("verifySync / reconcileInterruptedPlan 先驗輸入 kind", () => {
  assert.throws(
    () =>
      core.verifySync({
        plan: planned.inventory,
        beforeInventory: planned.inventory,
        afterInventory: planned.inventory,
        attempt: planned.inventory,
      }),
    code("ARTIFACT_KIND_MISMATCH"),
  );
  assert.throws(
    () =>
      core.reconcileInterruptedPlan({
        plan: planned.plan,
        inventory: planned.plan,
      }),
    code("ARTIFACT_KIND_MISMATCH"),
  );
});
