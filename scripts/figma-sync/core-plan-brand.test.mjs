import assert from "node:assert/strict";
import { test } from "node:test";

import { createFigmaBrandProjection } from "./brand.mjs";
import {
  BRAND_FILE,
  ROLES,
  brandFixture,
  createWorld,
  planBrandRun,
} from "./test-support.mjs";

const emptyLibrary = () => {
  const world = createWorld();
  world.addFile(BRAND_FILE, ["Brand"]);
  return world;
};
const codes = (plan) =>
  Array.from(new Set(plan.conflicts.map((conflict) => conflict.code))).sort();
const code = (expected) => (error) => error.code === expected;
const local = (world, store) =>
  Array.from(world[store].values()).filter(
    (item) => item.fileKey === BRAND_FILE,
  );

test("空品牌庫:兩集合 → 六 Brand 值 → 六 Color aliases → 一個 Shadow/Primary,相依以前序 create 參照", async () => {
  const world = emptyLibrary();
  const projection = createFigmaBrandProjection(brandFixture());
  const { plan } = await planBrandRun(world, { runId: "b1" });
  assert.equal(plan.status, "ready");
  assert.equal(plan.targetKind, "brand-library");
  assert.equal(plan.verification.target, "brand-bindings");
  assert.equal(plan.actions.length, 28);
  assert.deepEqual(
    plan.actions.slice(0, 2).map((action) => [action.operation, action.params]),
    ["Brand", "Color"].map((side) => [
      "create-collection",
      { collectionRole: side, name: side, modeName: "Light" },
    ]),
  );
  const ids = plan.actions.map((action) => action.actionId);
  for (const action of plan.actions) {
    const refs = [
      action.params.collectionRef,
      action.params.variableRef,
      action.params.styleRef,
      action.params.value?.targetRef,
    ].filter(Boolean);
    for (const ref of refs) {
      // 新建資產沒有 key:只能指向本 plan 前序的同 kind create action
      assert.deepEqual(Object.keys(ref), ["kind", "actionId"]);
      assert.ok(ids.indexOf(ref.actionId) < ids.indexOf(action.actionId));
    }
    if (/^create-/.test(action.operation)) {
      assert.equal(action.before, null);
      assert.equal(action.locator.key, null);
    }
  }
  for (const role of ROLES) {
    const brand = plan.actions.find(
      (action) => action.actionId === `set-variable-value:Brand:${role}`,
    );
    assert.deepEqual(brand.params.value, {
      kind: "rgba",
      rgba: projection.primary[role],
    });
    const color = plan.actions.find(
      (action) => action.actionId === `set-variable-value:Color:${role}`,
    );
    assert.deepEqual(color.params.value, {
      kind: "alias",
      targetRef: {
        kind: "variable",
        actionId: `create-variable:Brand:${role}`,
      },
    });
    assert.equal(color.params.modeName, "Light");
  }
  assert.deepEqual(plan.actions.at(-1).params.effects, [
    projection.primaryEffect,
  ]);
  assert.equal(plan.managedAssets.length, 15);
  assert.ok(plan.managedAssets.every((asset) => asset.key === null));
});

test("初建後再跑:零 action、仍通過驗證,累積登記保留首次 runId", async () => {
  const world = emptyLibrary();
  const first = await planBrandRun(world, { runId: "b1" });
  assert.equal(first.verdict.status, "verified");
  assert.equal(local(world, "collections").length, 2);
  assert.equal(local(world, "variables").length, 12);
  assert.equal(local(world, "styles").length, 1);
  for (const collection of local(world, "collections")) {
    assert.deepEqual(
      collection.modes.map((mode) => mode.name),
      ["Light"],
    );
  }
  world.resetLog();
  const second = await planBrandRun(world, {
    runId: "b2",
    previousReceipt: first.verdict.receipt,
  });
  assert.equal(second.plan.status, "noop");
  assert.equal(second.plan.actions.length, 0);
  assert.equal(world.mutations.length, 0);
  assert.equal(second.verdict.status, "verified");
  const receipt = second.verdict.receipt;
  assert.equal(
    receipt.previousReceiptDigest,
    second.plan.inputDigests.previousReceipt,
  );
  assert.equal(receipt.managedAssets.length, 15);
  assert.ok(
    receipt.managedAssets.every(
      (asset) =>
        asset.firstManagedRunId === "b1" &&
        asset.lastVerifiedRunId === "b2" &&
        typeof asset.key === "string",
    ),
  );
  assert.deepEqual(receipt.changes, {
    planned: 0,
    applied: 0,
    recoveredAlreadyApplied: 0,
    createdAssets: 0,
    importedAssets: 0,
  });
});

test("同名未登記資產阻擋,不按名稱認養也不另建", async () => {
  const world = emptyLibrary();
  world.addCollection(BRAND_FILE, "Brand", ["Light"]);
  world.addStyle(BRAND_FILE, "Shadow/Primary", []);
  const { plan, attempt } = await planBrandRun(world, { runId: "b1" });
  assert.equal(plan.status, "blocked");
  assert.deepEqual(codes(plan), ["UNREGISTERED_SAME_NAME"]);
  assert.deepEqual(
    plan.conflicts.map((conflict) => conflict.locator.assetKind),
    ["collection", "effect-style"],
  );
  assert.deepEqual(plan.actions, []);
  assert.equal(attempt, null);
  assert.equal(local(world, "collections").length, 1);
});

test("品牌輸入改變:只更新既有受管資產的值,以真 key 參照、不新建", async () => {
  const world = emptyLibrary();
  const first = await planBrandRun(world, { runId: "b1" });
  const projection = createFigmaBrandProjection(
    brandFixture("Acme", "#086B38"),
  );
  const second = await planBrandRun(world, {
    runId: "b2",
    previousReceipt: first.verdict.receipt,
    projection,
  });
  assert.equal(second.plan.status, "ready");
  const operations = new Set(
    second.plan.actions.map((action) => action.operation),
  );
  assert.deepEqual(Array.from(operations).sort(), [
    "set-effect-style-effects",
    "set-variable-value",
  ]);
  for (const action of second.plan.actions) {
    assert.notEqual(action.locator.collectionRole, "Color");
    const ref = action.params.variableRef ?? action.params.styleRef;
    assert.deepEqual(Object.keys(ref), ["kind", "key"]);
    assert.notEqual(action.before, null);
  }
  assert.equal(second.verdict.status, "verified");
  assert.equal(local(world, "variables").length, 12);
  const main = second.verdict.receipt.managedAssets.find(
    (asset) => asset.collectionRole === "Brand" && asset.role === "main",
  );
  assert.deepEqual(main.verifiedValue, {
    kind: "rgba",
    rgba: projection.primary.main,
  });
  assert.equal(main.firstManagedRunId, "b1");
});

test("受管資產被人工改值、刪除或加 mode:阻擋,不覆蓋", async () => {
  const run = async (tamper) => {
    const world = emptyLibrary();
    const first = await planBrandRun(world, { runId: "b1" });
    tamper(world);
    return planBrandRun(world, {
      runId: "b2",
      previousReceipt: first.verdict.receipt,
    });
  };
  const brandMain = (world) =>
    local(world, "variables").find(
      (variable) => variable.name === "primary/main",
    );

  const changed = await run((world) => {
    const variable = brandMain(world);
    const modeId = Object.keys(variable.valuesByMode)[0];
    variable.valuesByMode[modeId] = { r: 0, g: 0, b: 0, a: 1 };
  });
  assert.deepEqual(codes(changed.plan), ["MANAGED_VALUE_CHANGED"]);

  const deleted = await run((world) =>
    world.variables.delete(brandMain(world).id),
  );
  assert.ok(codes(deleted.plan).includes("MANAGED_ASSET_MISSING"));

  const extraMode = await run((world) => {
    const [collection] = local(world, "collections");
    collection.modes.push({ modeId: "extra", name: "Dark" });
  });
  assert.ok(codes(extraMode.plan).includes("MANAGED_ASSET_CHANGED"));
  assert.equal(extraMode.attempt, null);
});

test("其他檔案的 receipt 不能拿來規劃本檔", async () => {
  const world = emptyLibrary();
  const first = await planBrandRun(world, { runId: "b1" });
  const foreign = structuredClone(first.verdict.receipt);
  foreign.targetFileKey = "OTHERfile01";
  foreign.lastRunScope.fileKey = "OTHERfile01";
  for (const asset of foreign.managedAssets) asset.fileKey = "OTHERfile01";
  await assert.rejects(
    planBrandRun(world, { runId: "b2", previousReceipt: foreign }),
    code("RECEIPT_FOREIGN"),
  );
});

test("受管值被人工改成恰好等於本次新 desired:仍須驗 ownership,不 noop 悄悄收管", async () => {
  const world = emptyLibrary();
  const first = await planBrandRun(world, { runId: "b1" });
  const projection = createFigmaBrandProjection(
    brandFixture("Acme", "#086B38"),
  );
  // 還沒跑工具,有人先把 Brand/main 與陰影手動改成新品牌的值
  const main = local(world, "variables").find(
    (variable) =>
      variable.name === "primary/main" &&
      world.collections.get(variable.variableCollectionId).name === "Brand",
  );
  const modeId = Object.keys(main.valuesByMode)[0];
  main.valuesByMode[modeId] = projection.primary.main;
  local(world, "styles")[0].effects = [projection.primaryEffect];
  world.resetLog();
  const second = await planBrandRun(world, {
    runId: "b2",
    previousReceipt: first.verdict.receipt,
    projection,
  });
  assert.equal(second.plan.status, "blocked");
  assert.deepEqual(codes(second.plan), ["MANAGED_VALUE_CHANGED"]);
  assert.deepEqual(
    second.plan.conflicts.map((conflict) => [
      conflict.locator.assetKind,
      conflict.locator.collectionRole,
      conflict.locator.role,
    ]),
    [
      ["variable", "Brand", "main"],
      ["effect-style", null, "primary-shadow"],
    ],
  );
  assert.equal(second.attempt, null);
  assert.equal(world.mutations.length, 0);
  // 連品牌輸入都沒變、只有一個值被改成「恰好等於 desired 以外的東西再改回來」不算:現值等於 lastWritten 才是持有
  const untouched = emptyLibrary();
  const base = await planBrandRun(untouched, { runId: "b1" });
  const same = await planBrandRun(untouched, {
    runId: "b2",
    previousReceipt: base.verdict.receipt,
  });
  assert.equal(same.plan.status, "noop");
});
