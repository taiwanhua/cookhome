import assert from "node:assert/strict";
import { test } from "node:test";

import { createRuntime } from "./runtime.mjs";
import {
  BRAND_FILE,
  contract,
  core,
  createFakeFigma,
  createScenario,
  createWorld,
  fixed,
  makeRequest,
  planBrandRun,
  scan,
} from "./test-support.mjs";

const statuses = (reconciliation) =>
  reconciliation.actions.map((item) => item.status);
const code = (expected) => (error) => error.code === expected;

/** 規劃後在第 N 筆場景寫入時中斷;回傳原 plan、原 attempt 與情境。 */
async function interruptedSync(writesBeforeFailure) {
  const scenario = await createScenario();
  const planned = await scenario.sync("i1", { planOnly: true });
  const request = {
    ...planned.input.request,
    inputDigests: {
      ...planned.input.request.inputDigests,
      plan: contract.digest(planned.plan),
    },
  };
  scenario.world.failAfter = { scene: writesBeforeFailure };
  const figma = createFakeFigma(scenario.world, planned.plan.scope.fileKey);
  const attempt = await createRuntime(figma).applyPlan(request, planned.plan);
  scenario.world.failAfter = {};
  return { scenario, plan: planned.plan, attempt };
}

test("場景 action:等於 before → pending;等於 expectedAfter 且 guards 有效 → already-applied", async () => {
  const { scenario, plan, attempt } = await interruptedSync(3);
  assert.equal(attempt.status, "interrupted");
  assert.equal(attempt.completedActions.length, 3);
  const inventory = await scenario.scanConsumer("i1-rescan");
  const reconciliation = core.reconcileInterruptedPlan({
    plan,
    inventory,
    attempt: null,
  });
  assert.equal(reconciliation.planDigest, contract.digest(plan));
  assert.deepEqual(reconciliation.counts, {
    pending: 12,
    alreadyApplied: 3,
    conflict: 0,
  });
  // 逐筆以現值判定,不是依已寫筆數跳過前 N 筆
  assert.deepEqual(statuses(reconciliation).slice(0, 4), [
    "already-applied",
    "already-applied",
    "already-applied",
    "pending",
  ]);
  const applied = reconciliation.actions[0];
  assert.deepEqual(
    applied.readBack.value.key,
    plan.actions[0].expectedAfter.key,
  );
});

test("第三值、guards 失效與 slot 消失都是 conflict,不自動 rollback", async () => {
  const { scenario, plan } = await interruptedSync(3);
  const { nodes } = scenario.consumer;
  // 第 1 筆(已套用)被改成第三值;第 4 筆(尚未套用)的節點文字被改 → guard 失效
  nodes.button.fills = [fixed({ r: 0, g: 1, b: 0 })];
  nodes.customButton.children[0].characters = "又改了";
  scenario.consumer.root.children = scenario.consumer.root.children.filter(
    (node) => node !== nodes.image,
  );
  const inventory = await scenario.scanConsumer("i1-rescan");
  const reconciliation = core.reconcileInterruptedPlan({
    plan,
    inventory,
    attempt: null,
  });
  const byNode = (nodeId, field) =>
    reconciliation.actions.find(
      (item) =>
        item.action.locator.nodeId === nodeId &&
        item.action.locator.field === field,
    );
  assert.equal(byNode("10:2", "fill-color").code, "THIRD_VALUE");
  assert.equal(byNode("I10:3;1:11", "fill-color").code, "STALE_GUARD");
  assert.equal(byNode("10:7", "fill-color").code, "SLOT_MISSING");
  assert.equal(reconciliation.counts.conflict, 3);
  // 節點上已寫入的其他值原樣留著
  assert.equal(byNode("10:2", "stroke-color").status, "already-applied");
});

test("恢復 plan:記原 planDigest,只規劃剩餘筆數,完整精驗後才有成功狀態", async () => {
  const { scenario, plan, attempt } = await interruptedSync(3);
  assert.equal(attempt.errors[0].code, "WRITE_FAILED");
  const resumed = await scenario.sync("i2", {
    resumePlan: plan,
    resumeAttempt: { ...attempt, afterInventoryDigest: null },
  });
  assert.notEqual(resumed.plan.runId, plan.runId);
  assert.equal(resumed.plan.inputDigests.plan, contract.digest(plan));
  assert.equal(resumed.plan.actions.length, 12);
  assert.equal(resumed.plan.verification.recoveredAlreadyApplied, 3);
  assert.equal(resumed.plan.managedSlots.length, 15);
  assert.equal(resumed.verdict.status, "verified");
  assert.deepEqual(resumed.verdict.receipt.changes, {
    planned: 12,
    applied: 12,
    recoveredAlreadyApplied: 3,
    createdAssets: 0,
    importedAssets: 6,
  });
  // 完成後重跑零修改
  const again = await scenario.sync("i3", {
    previousReceipt: resumed.verdict.receipt,
  });
  assert.equal(again.plan.status, "noop");
  assert.equal(again.verdict.status, "verified");
});

test("恢復時遇第三值:新 plan blocked,不寫成功狀態", async () => {
  const { scenario, plan } = await interruptedSync(3);
  scenario.consumer.nodes.button.fills = [fixed({ r: 0, g: 1, b: 0 })];
  const resumed = await scenario.sync("i2", { resumePlan: plan });
  assert.equal(resumed.plan.status, "blocked");
  assert.equal(resumed.attempt, null);
  assert.equal(resumed.verdict, null);
});

test("attempt 與 plan 不是同一輪 → ATTEMPT_PLAN_MISMATCH", async () => {
  const { scenario, plan, attempt } = await interruptedSync(1);
  const inventory = await scenario.scanConsumer("i1-rescan");
  assert.throws(
    () =>
      core.reconcileInterruptedPlan({
        plan,
        inventory,
        attempt: { ...attempt, planDigest: contract.digest("other") },
      }),
    code("ATTEMPT_PLAN_MISMATCH"),
  );
});

// ── 品牌庫:create 的身分 ───────────────────────────────────────────────────

async function interruptedBrand(assetWritesBeforeFailure) {
  const world = createWorld();
  world.addFile(BRAND_FILE, ["Brand"]);
  const brand = await scan(
    world,
    "brand-library",
    BRAND_FILE,
    [`P${BRAND_FILE}:0`],
    "c1-scan",
  );
  const base = makeRequest({
    operation: "apply",
    targetKind: "brand-library",
    fileKey: BRAND_FILE,
    roots: brand.scope.rootNodeIds,
    runId: "c1",
    inputDigests: { inventories: [contract.digest(brand)] },
  });
  const plan = core.planSync({ request: base, inventories: { brand } });
  const request = {
    ...base,
    inputDigests: { ...base.inputDigests, plan: contract.digest(plan) },
  };
  world.failAfter = { asset: assetWritesBeforeFailure };
  const attempt = await createRuntime(
    createFakeFigma(world, BRAND_FILE),
  ).applyPlan(request, plan);
  world.failAfter = {};
  const rescan = () =>
    scan(
      world,
      "brand-library",
      BRAND_FILE,
      brand.scope.rootNodeIds,
      "c1-rescan",
    );
  return { world, plan, attempt, rescan };
}

test("create 已發生但回應遺失:不按名稱認養、不再建,回 CREATED_ASSET_IDENTITY_UNRESOLVED", async () => {
  // 兩個集合與一個變數已建立;回應完全遺失 = 沒有 attempt
  const { world, plan, rescan } = await interruptedBrand(3);
  const inventory = await rescan();
  const lost = core.reconcileInterruptedPlan({
    plan,
    inventory,
    attempt: null,
  });
  const created = lost.actions.filter((item) =>
    /^create-/.test(item.action.operation),
  );
  assert.deepEqual(
    created.slice(0, 3).map((item) => item.code),
    // 兩個同名集合已存在卻沒有 readBack;變數所屬集合的身分未解,連同名都無從判定
    [
      "CREATED_ASSET_IDENTITY_UNRESOLVED",
      "CREATED_ASSET_IDENTITY_UNRESOLVED",
      "DEPENDENCY_UNRESOLVED",
    ],
  );
  // 相依於未解身分的後續 action 也不能執行
  assert.ok(lost.actions.every((item) => item.status !== "already-applied"));
  assert.ok(lost.counts.conflict >= 3);

  const before = world.collections.size;
  const resumed = await planBrandRun(world, { runId: "c2", resumePlan: plan });
  assert.equal(resumed.plan.status, "blocked");
  assert.ok(
    resumed.plan.conflicts.some(
      (conflict) => conflict.code === "CREATED_ASSET_IDENTITY_UNRESOLVED",
    ),
  );
  assert.deepEqual(resumed.plan.actions, []);
  assert.equal(world.collections.size, before);
});

test("有原 run 封存 attempt 的 readBack:已建立者認回真身分,只補剩餘", async () => {
  const { world, plan, attempt } = await interruptedBrand(3);
  assert.equal(attempt.status, "interrupted");
  const readBacks = attempt.completedActions.filter(
    (done) => done.readBack.kind !== undefined,
  );
  assert.equal(readBacks.length, 3);
  assert.equal(readBacks[0].readBack.kind, "collection");
  assert.ok(readBacks[0].readBack.defaultModeId);

  const resumed = await planBrandRun(world, {
    runId: "c2",
    resumePlan: plan,
    resumeAttempt: attempt,
  });
  assert.equal(resumed.plan.status, "ready");
  assert.equal(resumed.plan.inputDigests.plan, contract.digest(plan));
  const creates = resumed.plan.actions.filter((action) =>
    /^create-/.test(action.operation),
  );
  // 15 個資產中 3 個已由 readBack 確認,只再建 12 個
  assert.equal(creates.length, 12);
  // 已存在的集合以真 key 參照,不再是 actionId
  const variable = resumed.plan.actions.find(
    (action) => action.actionId === "create-variable:Brand:light",
  );
  assert.deepEqual(variable.params.collectionRef, {
    kind: "collection",
    key: readBacks[0].readBack.key,
  });
  assert.equal(resumed.verdict.status, "verified");
  assert.equal(resumed.verdict.receipt.managedAssets.length, 15);
  assert.equal(
    Array.from(world.collections.values()).filter(
      (item) => item.fileKey === BRAND_FILE,
    ).length,
    2,
  );
  const again = await planBrandRun(world, {
    runId: "c3",
    previousReceipt: resumed.verdict.receipt,
  });
  assert.equal(again.plan.status, "noop");
});

test("品牌庫恢復:新建資產寫入後被人工改成第三值是 conflict,不會被覆寫", async () => {
  // 28 筆都完成並留有 readBack,只是整輪還沒 record;之後有人改了 Brand/main 與陰影
  const { world, plan, attempt, rescan } = await interruptedBrand(1000);
  assert.equal(attempt.status, "applied");
  const own = (store) =>
    Array.from(world[store].values()).filter(
      (item) => item.fileKey === BRAND_FILE,
    );
  const main = own("variables").find(
    (variable) =>
      variable.name === "primary/main" &&
      world.collections.get(variable.variableCollectionId).name === "Brand",
  );
  const modeId = Object.keys(main.valuesByMode)[0];
  const manual = { r: 0.1, g: 0.2, b: 0.3, a: 1 };
  main.valuesByMode[modeId] = manual;
  own("styles")[0].effects = [];

  const reconciliation = core.reconcileInterruptedPlan({
    plan,
    inventory: await rescan(),
    attempt,
  });
  const byId = (actionId) =>
    reconciliation.actions.find((item) => item.actionId === actionId);
  assert.equal(byId("create-variable:Brand:main").status, "already-applied");
  assert.equal(byId("set-variable-value:Brand:main").status, "conflict");
  assert.equal(byId("set-variable-value:Brand:main").code, "THIRD_VALUE");
  // 陰影被清空:值恰好等於建立初值,但原 attempt 已有這筆寫入的 readBack,仍是第三值
  assert.equal(byId("set-effect-style-effects").code, "THIRD_VALUE");
  assert.equal(reconciliation.counts.conflict, 2);
  assert.equal(reconciliation.counts.pending, 0);

  world.resetLog();
  const resumed = await planBrandRun(world, {
    runId: "c2",
    resumePlan: plan,
    resumeAttempt: attempt,
  });
  assert.equal(resumed.plan.status, "blocked");
  assert.deepEqual(resumed.plan.actions, []);
  assert.ok(
    resumed.plan.conflicts.some((conflict) => conflict.code === "THIRD_VALUE"),
  );
  assert.equal(resumed.attempt, null);
  assert.equal(world.mutations.length, 0);
  assert.deepEqual(main.valuesByMode[modeId], manual);
});

test("品牌庫恢復:尚未寫入的新建變數,現值仍是建立初值才算 pending", async () => {
  // 兩個集合與第一個變數已建立(有 readBack),它的 set 還沒執行
  const { world, plan, attempt, rescan } = await interruptedBrand(3);
  const pending = core.reconcileInterruptedPlan({
    plan,
    inventory: await rescan(),
    attempt,
  });
  const first = (reconciliation) =>
    reconciliation.actions.find(
      (item) => item.actionId === "set-variable-value:Brand:lighter",
    );
  assert.equal(first(pending).status, "pending");
  const created = Array.from(world.variables.values()).find(
    (variable) => variable.fileKey === BRAND_FILE,
  );
  created.valuesByMode[Object.keys(created.valuesByMode)[0]] = {
    r: 0,
    g: 0,
    b: 0,
    a: 1,
  };
  const changed = core.reconcileInterruptedPlan({
    plan,
    inventory: await rescan(),
    attempt,
  });
  assert.equal(first(changed).status, "conflict");
  assert.equal(first(changed).code, "THIRD_VALUE");
  // 別輪 run 的 attempt 不能拿來當恢復證據
  const inventory = await rescan();
  const foreign = { ...attempt, runId: "another-run", afterInventory: null };
  assert.throws(
    () => core.reconcileInterruptedPlan({ plan, inventory, attempt: foreign }),
    (error) => error.code === "ATTEMPT_PLAN_MISMATCH",
  );
});
