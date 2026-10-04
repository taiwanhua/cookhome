import assert from "node:assert/strict";
import { test } from "node:test";

import { createContract } from "./core-contract.mjs";
import { createConsumerGuards } from "./core-plan-consumer-guards.mjs";
import {
  BASE_FILE,
  bound,
  contract,
  createScenario,
  scan,
  selectionsFor,
} from "./test-support.mjs";

const guards = createConsumerGuards(createContract());
const codes = (plan) =>
  Array.from(new Set(plan.conflicts.map((conflict) => conflict.code))).sort();
const aliasTo = (variable) => ({ type: "VARIABLE_ALIAS", id: variable.id });
const rescanBase = async (scenario, runId) => {
  scenario.inventories.base = await scan(
    scenario.world,
    "base-library",
    BASE_FILE,
    [scenario.base.page.id],
    runId,
  );
};

test("同一把 binding key 的 alias 改指別的語意:現值、key、來源節點都沒變也要列 SOURCE_ROLE_DRIFT", async () => {
  const scenario = await createScenario();
  const first = await scenario.sync("a1");
  const previousReceipt = first.verdict.receipt;
  // Library 保留 Color/primary/main 這把 key,但把它的 alias 從 Brand/main 改指 Brand/light
  const { color, brand } = scenario.base;
  const modeId = Object.keys(color.main.valuesByMode)[0];
  color.main.valuesByMode[modeId] = aliasTo(brand.light);
  await rescanBase(scenario, "scan-base-2");

  // 新的審查已明確把這把 key 選成 light / 專案的 light
  const selections = selectionsFor(
    scenario.inventories.base,
    scenario.inventories.brand,
  );
  const reselected = selections.find(
    (item) => item.source.key === color.main.key,
  );
  const light = selections.find((item) => item.source.key === color.light.key);
  reselected.role = "light";
  reselected.project = light.project;
  const inventory = await scenario.scanConsumer("a2-scan");
  const button = inventory.slots.find(
    (slot) =>
      slot.locator.nodeId === "10:2" && slot.locator.field === "fill-color",
  );
  // consumer 的工具 override 仍是專案 main;來源的 binding key 與節點身分都沒變
  assert.equal(button.sourceMatch.sourceSlot.bindingKey, color.main.key);
  const prior = previousReceipt.managedSlots.find(
    (slot) =>
      contract.slotKey(slot.locator) === contract.slotKey(button.locator),
  );
  assert.equal(prior.source.bindingKey, color.main.key);
  assert.equal(button.sourceMatch.sourceNodeId, prior.source.sourceNodeId);
  assert.equal(button.value.key, prior.lastWrittenValue.key);

  const drifted = await scenario.sync("a2", {
    previousReceipt,
    inventory,
    identityReview: scenario.review(inventory, [], { selections }),
    planOnly: true,
  });
  assert.equal(drifted.plan.status, "blocked");
  assert.deepEqual(codes(drifted.plan), ["SOURCE_ROLE_DRIFT"]);
  const conflicted = drifted.plan.conflicts.map(
    (conflict) => `${conflict.locator.nodeId}|${conflict.locator.field}`,
  );
  assert.ok(conflicted.includes("10:2|fill-color"));
  // 明示採新語意後才改寫成專案的 light
  // 有來源對照的才能採新語意;沒有來源可確認的 direct binding 只能明示釋出
  const sourced = (conflict) =>
    inventory.slots.find(
      (slot) =>
        contract.slotKey(slot.locator) === contract.slotKey(conflict.locator),
    ).sourceMatch.sourceSlot !== null;
  const resolutions = drifted.plan.conflicts.map((conflict) => ({
    locator: conflict.locator,
    consumerInventoryDigest: conflict.observed.consumerInventoryDigest,
    before: conflict.observed.value,
    sourceMatchDigest: conflict.observed.sourceMatchDigest,
    decision: sourced(conflict) ? "adopt-source" : "preserve-project",
    expectedRole: sourced(conflict) ? "light" : null,
  }));
  const adopting = resolutions.filter((item) => item.expectedRole).length;
  assert.ok(adopting >= 1 && adopting < resolutions.length);
  const repaired = await scenario.sync("a3", {
    previousReceipt,
    inventory,
    identityReview: scenario.review(inventory, resolutions, { selections }),
  });
  assert.deepEqual(codes(repaired.plan), []);
  assert.equal(repaired.verdict.status, "verified");
  assert.ok(repaired.plan.actions.every((action) => action.role === "light"));
  assert.equal(repaired.plan.actions.length, adopting);
  assert.equal(
    repaired.verdict.receipt.releasedSlots.length,
    resolutions.length - adopting,
  );
});

test("alias 鏈改了但審查沒跟上:同樣是漂移,不沿用舊 main", async () => {
  const scenario = await createScenario();
  const first = await scenario.sync("b1");
  // Color/main 改成經由另一把變數再指向 Brand/main:終點同色,鏈已不同
  const { color, brand, world = scenario.world } = scenario.base;
  const collection = scenario.world.collections.get(
    color.main.variableCollectionId,
  );
  const hop = scenario.world.addVariable(BASE_FILE, "hop", collection, {
    [collection.defaultModeId]: aliasTo(brand.main),
  });
  color.main.valuesByMode[collection.defaultModeId] = aliasTo(hop);
  assert.ok(world);
  await rescanBase(scenario, "scan-base-3");
  const { plan } = await scenario.sync("b2", {
    previousReceipt: first.verdict.receipt,
    planOnly: true,
  });
  assert.deepEqual(codes(plan), ["SOURCE_ROLE_DRIFT"]);
});

test("來源節點身分以完整祖先鏈比對:任何一層的 guard 改變都是 SOURCE_IDENTITY_CHANGED", async () => {
  const scenario = await createScenario();
  const first = await scenario.sync("c1");
  // SideNav 來源多了一個尾端 child:child index 與節點都沒變,但每層的 child count guard 變了
  const { sideNav } = scenario.base.components;
  sideNav.append(
    scenario.world.node(BASE_FILE, { id: "1:49", type: "FRAME", children: [] }),
  );
  scenario.consumer.nodes.sideNav.append(
    scenario.world.node(scenario.consumer.fileKey, {
      id: "I10:5;1:49",
      type: "FRAME",
      children: [],
    }),
  );
  const { plan } = await scenario.sync("c2", {
    previousReceipt: first.verdict.receipt,
    planOnly: true,
  });
  assert.deepEqual(codes(plan), ["SOURCE_IDENTITY_CHANGED"]);
  assert.ok(
    plan.conflicts.every(
      (conflict) => conflict.locator.rootInstanceId === "10:5",
    ),
  );
});

test("sourceProblem:結構已驗才可受管;direct binding 只在 brand-bindings 成立", () => {
  const slot = (status, reason) => ({ sourceMatch: { status, reason } });
  assert.equal(guards.sourceProblem(slot("exact-root", null), true), null);
  assert.equal(
    guards.sourceProblem(slot("validated-structure", null), true),
    null,
  );
  assert.equal(
    guards.sourceProblem(slot("unresolved", "NOT_IN_INSTANCE"), false),
    null,
  );
  assert.equal(
    guards.sourceProblem(slot("unresolved", "NOT_IN_INSTANCE"), true),
    "SOURCE_MATCH_UNSUPPORTED",
  );
  for (const reason of [
    "PAINT_SHAPE_CONFLICT",
    "STRUCTURE_MISMATCH",
    "BROKEN_INSTANCE",
    "SOURCE_ALIAS_CYCLE",
  ]) {
    assert.equal(
      guards.sourceProblem(slot("unresolved", reason), false),
      reason,
    );
  }
});

test("vanishedInScope:看保存的祖先鏈裡有沒有本次的 root 或範圍內仍存在的節點", () => {
  const state = {
    consumer: { scope: { pageIds: ["P:0"] } },
    roots: new Set(["10:1"]),
    liveNodes: new Set(["10:1", "10:5"]),
  };
  const evidence = (ancestorIds, pageId = "P:0") => ({
    pageId,
    scopeRootId: "10:1",
    ancestorIds,
  });
  assert.equal(
    guards.vanishedInScope(state, evidence(["10:9", "10:1", "P:0"])),
    true,
  );
  assert.equal(
    guards.vanishedInScope(state, evidence(["10:5", "20:1", "P:0"])),
    true,
  );
  assert.equal(
    guards.vanishedInScope(state, evidence(["20:2", "20:1", "P:0"])),
    false,
  );
  assert.equal(
    guards.vanishedInScope(state, evidence(["10:9", "10:1", "P:1"], "P:1")),
    false,
  );
  // 整頁是 root 時,頁內消失的節點都在範圍內
  state.roots = new Set(["P:0"]);
  assert.equal(
    guards.vanishedInScope(state, evidence(["20:2", "20:1", "P:0"])),
    true,
  );
});

test("evidenceConflicts:file、scope 與已變更資產的接受情形逐項核對", async () => {
  const scenario = await createScenario();
  const consumer = await scenario.scanConsumer("ev-scan", ["10:2"]);
  const { base } = scenario.inventories;
  const key = scenario.base.components.button.key;
  const request = (publication, acceptance) => ({
    publicationEvidence: publication && {
      sourceFileKey: BASE_FILE,
      changedAssetKeys: [key],
      ...publication,
    },
    acceptanceEvidence: acceptance && {
      sourceFileKey: BASE_FILE,
      consumerFileKey: consumer.observedFileKey,
      acceptedAssetKeys: [key],
      pageIds: [],
      rootNodeIds: ["10:2"],
      ...acceptance,
    },
  });
  const check = (publication, acceptance) =>
    guards
      .evidenceConflicts(request(publication, acceptance), base, consumer, [
        key,
      ])
      .map((conflict) => conflict.code);
  assert.deepEqual(check({}, {}), []);
  assert.deepEqual(check(null, {}), ["EVIDENCE_REQUIRED"]);
  assert.deepEqual(check({}, { acceptedAssetKeys: [] }), [
    "PARTIAL_ACCEPTANCE",
  ]);
  assert.deepEqual(check({ sourceFileKey: "X" }, {}), [
    "EVIDENCE_FILE_MISMATCH",
  ]);
  assert.deepEqual(check({}, { rootNodeIds: ["10:5"] }), [
    "EVIDENCE_SCOPE_MISMATCH",
  ]);
  // 以 page 涵蓋也算;沒變更的資產不要求接受
  assert.deepEqual(
    check({}, { rootNodeIds: [], pageIds: consumer.scope.pageIds }),
    [],
  );
  assert.deepEqual(
    check({ changedAssetKeys: [] }, { acceptedAssetKeys: [] }),
    [],
  );
  assert.ok(bound);
});
