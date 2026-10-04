import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CONSUMER_FILE,
  bound,
  contract,
  createScenario,
  fixed,
} from "./test-support.mjs";

const slotOf = (inventory, nodeId, field = "fill-color") =>
  inventory.slots.find(
    (slot) => slot.locator.nodeId === nodeId && slot.locator.field === field,
  );
const codes = (plan) => plan.conflicts.map((conflict) => conflict.code).sort();
const actionFor = (plan, nodeId, field = "fill-color") =>
  plan.actions.find(
    (action) =>
      action.locator.nodeId === nodeId && action.locator.field === field,
  );
const resolutionFor = (inventory, slot, decision, expectedRole = null) => ({
  locator: slot.locator,
  consumerInventoryDigest: contract.digest(inventory),
  before: slot.value,
  sourceMatchDigest: contract.digest(slot.sourceMatch),
  decision,
  expectedRole,
});
const missingResolution = (inventory, locator) => ({
  locator,
  consumerInventoryDigest: contract.digest(inventory),
  before: { kind: "missing" },
  sourceMatchDigest: null,
  decision: "preserve-project",
  expectedRole: null,
});
const projectKey = (scenario, role) =>
  scenario.brandReceipt.managedAssets.find(
    (asset) =>
      asset.kind === "variable" &&
      asset.role === role &&
      asset.collectionRole === "Color",
  ).key;

test("受管 slot 被改成固定色:明示採來源後依 field 寫回 variable,不沿用被取代的 kind", async () => {
  const scenario = await createScenario();
  const first = await scenario.sync("f1");
  const previousReceipt = first.verdict.receipt;
  scenario.consumer.nodes.button.fills = [fixed({ r: 0, g: 0, b: 0 })];

  const blocked = await scenario.sync("f2", {
    previousReceipt,
    planOnly: true,
  });
  assert.deepEqual(codes(blocked.plan), ["MANAGED_VALUE_CHANGED"]);
  const inventory = blocked.inventory;
  const slot = slotOf(inventory, "10:2");
  assert.equal(slot.value.kind, "fixed");

  const repaired = await scenario.sync("f3", {
    previousReceipt,
    inventory,
    identityReview: scenario.review(inventory, [
      resolutionFor(inventory, slot, "adopt-source", "main"),
    ]),
  });
  assert.equal(repaired.plan.status, "ready");
  assert.equal(repaired.plan.actions.length, 1);
  const action = repaired.plan.actions[0];
  assert.equal(action.operation, "set-paint-variable");
  assert.deepEqual(action.before, slot.value);
  assert.deepEqual(action.expectedAfter, {
    kind: "variable",
    key: projectKey(scenario, "main"),
  });
  assert.equal(repaired.verdict.status, "verified");
  const managed = repaired.verdict.receipt.managedSlots.find(
    (item) =>
      item.locator.nodeId === "10:2" && item.locator.field === "fill-color",
  );
  assert.deepEqual(managed.lastWrittenValue, action.expectedAfter);
  assert.equal(managed.firstManagedRunId, "f1");
  // 保留專案則釋出;固定色留著
  const released = await scenario.sync("f4", {
    previousReceipt,
    inventory,
    identityReview: scenario.review(inventory, [
      resolutionFor(inventory, slot, "preserve-project"),
    ]),
    planOnly: true,
  });
  assert.equal(released.plan.status, "noop");
  assert.equal(released.plan.releasedSlots.length, 1);
});

test("首次即為手動固定色、來源是品牌語意:adopt-source 同樣可綁回 variable", async () => {
  const scenario = await createScenario();
  const inventory = await scenario.scanConsumer("g1-scan");
  const slot = slotOf(inventory, "10:3");
  assert.equal(slot.value.kind, "fixed");
  const run = await scenario.sync("g1", {
    inventory,
    identityReview: scenario.review(inventory, [
      resolutionFor(inventory, slot, "adopt-source", "main"),
    ]),
  });
  assert.equal(actionFor(run.plan, "10:3").expectedAfter.kind, "variable");
  assert.equal(run.verdict.status, "verified");
  assert.ok(!run.plan.preserved.some((item) => item.locator.nodeId === "10:3"));
});

test("釋出後節點被重建:新 locator 不會繞過 tombstone 自動收管", async () => {
  const scenario = await createScenario();
  const first = await scenario.sync("t1");
  const before = await scenario.scanConsumer("t2-scan");
  const label = slotOf(before, "I10:2;1:11");
  const release = await scenario.sync("t2", {
    previousReceipt: first.verdict.receipt,
    inventory: before,
    identityReview: scenario.review(before, [
      resolutionFor(before, label, "preserve-project"),
    ]),
  });
  const receipt = release.verdict.receipt;
  assert.equal(receipt.releasedSlots.length, 1);
  assert.deepEqual(receipt.releasedSlots[0].scopeEvidence.ancestorIds, [
    "10:2",
    "10:1",
    scenario.consumer.page.id,
  ]);

  // Library 更新後同一位置的圖層被刪除重建:新 nodeId、直接綁底座 key;來源結構不變
  const { button } = scenario.consumer.nodes;
  const old = button.children[0];
  const rebuilt = scenario.world.node(CONSUMER_FILE, {
    ...old,
    id: "I10:2;9:99",
    fills: [bound(scenario.base.color.contrast)],
  });
  button.children = [];
  button.append(rebuilt);

  const blocked = await scenario.sync("t3", {
    previousReceipt: receipt,
    planOnly: true,
  });
  assert.equal(blocked.plan.status, "blocked");
  assert.deepEqual(codes(blocked.plan), ["RELEASED_IDENTITY_UNRESOLVED"]);
  assert.equal(blocked.plan.conflicts[0].locator.nodeId, "I10:2;9:99");
  assert.equal(actionFor(blocked.plan, "I10:2;9:99"), undefined);
  // tombstone 原樣留著,沒有被新 locator 取代或刪除
  assert.deepEqual(blocked.plan.releasedSlots, receipt.releasedSlots);

  // 審查後的兩種出路:對新 locator 明示採來源,或確認舊節點已不存在並保留新節點
  const inventory = blocked.inventory;
  const fresh = slotOf(inventory, "I10:2;9:99");
  const adopt = await scenario.sync("t4", {
    previousReceipt: receipt,
    inventory,
    identityReview: scenario.review(inventory, [
      resolutionFor(inventory, fresh, "adopt-source", "contrast"),
    ]),
  });
  assert.equal(adopt.verdict.status, "verified");
  assert.equal(actionFor(adopt.plan, "I10:2;9:99").role, "contrast");
  assert.equal(adopt.verdict.receipt.releasedSlots.length, 1);

  const keepBoth = await scenario.sync("t5", {
    previousReceipt: receipt,
    inventory,
    identityReview: scenario.review(inventory, [
      missingResolution(inventory, label.locator),
      resolutionFor(inventory, fresh, "preserve-project"),
    ]),
    planOnly: true,
  });
  assert.deepEqual(codes(keepBoth.plan), []);
  assert.deepEqual(
    keepBoth.plan.releasedSlots.map((slot) => slot.reason).sort(),
    ["node-missing", "preserve-project"],
  );
});

test("範圍內消失的非 instance 受管節點:靠保存的 scope 證據判定,不當成 scope 外", async () => {
  const scenario = await createScenario();
  const first = await scenario.sync("n1");
  const previousReceipt = first.verdict.receipt;
  const managed = previousReceipt.managedSlots.find(
    (slot) => slot.locator.nodeId === "10:7",
  );
  assert.equal(managed.locator.rootInstanceId, null);
  assert.deepEqual(managed.scopeEvidence, {
    pageId: scenario.consumer.page.id,
    scopeRootId: "10:1",
    ancestorIds: ["10:1", scenario.consumer.page.id],
  });
  const { root, nodes } = scenario.consumer;
  root.children = root.children.filter((node) => node !== nodes.image);

  const blocked = await scenario.sync("n2", {
    previousReceipt,
    planOnly: true,
  });
  assert.deepEqual(codes(blocked.plan), ["MANAGED_SLOT_MISSING"]);
  assert.equal(blocked.plan.conflicts[0].locator.nodeId, "10:7");
  // 換成不含它的範圍:確實在 scope 外,原樣保留舊登記與舊的驗證 run
  const elsewhere = await scenario.sync("n3", {
    previousReceipt,
    roots: ["10:2"],
  });
  assert.equal(elsewhere.plan.status, "noop");
  assert.equal(elsewhere.verdict.status, "verified");
  assert.ok(
    !elsewhere.plan.managedSlots.some((slot) => slot.locator.nodeId === "10:7"),
  );
  assert.equal(
    elsewhere.verdict.receipt.managedSlots.find(
      (slot) => slot.locator.nodeId === "10:7",
    ).lastVerifiedRunId,
    "n1",
  );
  // 明示確認後才釋出,留下可追溯的紀錄
  const inventory = blocked.inventory;
  const acknowledged = await scenario.sync("n4", {
    previousReceipt,
    inventory,
    identityReview: scenario.review(inventory, [
      missingResolution(inventory, managed.locator),
    ]),
  });
  assert.equal(acknowledged.verdict.status, "verified");
  const receipt = acknowledged.verdict.receipt;
  assert.ok(
    !receipt.managedSlots.some((slot) => slot.locator.nodeId === "10:7"),
  );
  assert.equal(receipt.releasedSlots[0].reason, "node-missing");
  assert.deepEqual(
    receipt.releasedSlots[0].scopeEvidence,
    managed.scopeEvidence,
  );
});

test("受管的 effect style 被移除(節點還在、已無 slot):不沿用舊登記", async () => {
  const scenario = await createScenario();
  const styled = scenario.world.node(CONSUMER_FILE, {
    id: "10:30",
    type: "RECTANGLE",
    effectStyleId: scenario.base.shadow.id,
  });
  scenario.consumer.root.append(styled);
  const first = await scenario.sync("e1");
  const previousReceipt = first.verdict.receipt;
  assert.ok(
    previousReceipt.managedSlots.some(
      (slot) => slot.locator.nodeId === "10:30",
    ),
  );
  await styled.setEffectStyleIdAsync("");
  const next = await scenario.sync("e2", { previousReceipt, planOnly: true });
  assert.equal(slotOf(next.inventory, "10:30", "effect-style"), undefined);
  assert.ok(next.inventory.nodes.some((node) => node.nodeId === "10:30"));
  assert.deepEqual(codes(next.plan), ["MANAGED_SLOT_MISSING"]);
});

test("恢復證據才是無 receipt 時的 ownership:原 plan 的 expectedAfter 與 guards", async () => {
  const scenario = await createScenario();
  const planned = await scenario.sync("r1", { planOnly: true });
  // 另一個人手動把同一把專案 key 綁到 error 按鈕:不在原 plan 內
  const project = Array.from(scenario.world.variables.values()).find(
    (variable) => variable.key === projectKey(scenario, "main"),
  );
  await scenario.sync("r1-apply", { inventory: planned.inventory });
  scenario.consumer.nodes.errorButton.fills = [bound(project)];
  const resumed = await scenario.sync("r2", {
    resumePlan: planned.plan,
    planOnly: true,
  });
  assert.equal(resumed.plan.status, "noop");
  assert.equal(resumed.plan.verification.recoveredAlreadyApplied, 15);
  assert.equal(resumed.plan.managedSlots.length, 15);
  assert.ok(
    !resumed.plan.managedSlots.some((slot) => slot.locator.nodeId === "10:8"),
  );
  assert.ok(
    resumed.plan.preserved.some(
      (item) =>
        item.locator.nodeId === "10:8" &&
        item.reason === "project-brand-binding-unowned",
    ),
  );
});

test("tombstone 的舊 parent 被刪:以仍存續的祖先核對,新 locator 不自動收管", async () => {
  const scenario = await createScenario();
  const { world, consumer, base } = scenario;
  const container = world.node(CONSUMER_FILE, {
    id: "10:50",
    type: "FRAME",
    children: [
      world.node(CONSUMER_FILE, {
        id: "10:51",
        type: "RECTANGLE",
        fills: [bound(base.color.main)],
      }),
    ],
  });
  consumer.root.append(container);
  const first = await scenario.sync("ta1");
  const before = await scenario.scanConsumer("ta2-scan");
  const released = await scenario.sync("ta2", {
    previousReceipt: first.verdict.receipt,
    inventory: before,
    identityReview: scenario.review(before, [
      resolutionFor(before, slotOf(before, "10:51"), "preserve-project"),
    ]),
  });
  const receipt = released.verdict.receipt;
  assert.deepEqual(receipt.releasedSlots[0].scopeEvidence.ancestorIds, [
    "10:50",
    "10:1",
    consumer.page.id,
  ]);
  // 容器 P 連同釋出的子節點被刪;同一受管 scope 下建立新的容器 Q 與新的底座綁定
  consumer.root.children = consumer.root.children.filter(
    (node) => node !== container,
  );
  consumer.root.append(
    world.node(CONSUMER_FILE, {
      id: "10:60",
      type: "FRAME",
      children: [
        world.node(CONSUMER_FILE, {
          id: "10:61",
          type: "RECTANGLE",
          fills: [bound(base.color.main)],
        }),
      ],
    }),
  );
  const blocked = await scenario.sync("ta3", {
    previousReceipt: receipt,
    planOnly: true,
  });
  assert.deepEqual(codes(blocked.plan), ["RELEASED_IDENTITY_UNRESOLVED"]);
  assert.equal(blocked.plan.conflicts[0].locator.nodeId, "10:61");
  assert.equal(actionFor(blocked.plan, "10:61"), undefined);
  assert.equal(blocked.plan.releasedSlots.length, 1);
  // 新 locator 自己的 fresh adopt-source 才能收管(沒有來源 counterpart 的 direct binding)
  const inventory = blocked.inventory;
  const adopted = await scenario.sync("ta4", {
    previousReceipt: receipt,
    inventory,
    identityReview: scenario.review(inventory, [
      resolutionFor(
        inventory,
        slotOf(inventory, "10:61"),
        "adopt-source",
        "main",
      ),
    ]),
  });
  assert.equal(adopted.verdict.status, "verified");
  assert.equal(actionFor(adopted.plan, "10:61").role, "main");
});

test("對舊的 missing locator 做 preserve-project 不等於同意收管新 locator;之後也不因 node-missing 解除", async () => {
  const scenario = await createScenario();
  const first = await scenario.sync("tb1");
  const before = await scenario.scanConsumer("tb2-scan");
  const label = slotOf(before, "I10:2;1:11");
  const release = await scenario.sync("tb2", {
    previousReceipt: first.verdict.receipt,
    inventory: before,
    identityReview: scenario.review(before, [
      resolutionFor(before, label, "preserve-project"),
    ]),
  });
  const { button } = scenario.consumer.nodes;
  const rebuilt = scenario.world.node(CONSUMER_FILE, {
    ...button.children[0],
    id: "I10:2;9:99",
    fills: [bound(scenario.base.color.contrast)],
  });
  button.children = [];
  button.append(rebuilt);
  const inventory = await scenario.scanConsumer("tb3-scan");
  // 只確認舊節點已不存在,沒有對新 locator 做任何決定
  const acknowledged = await scenario.sync("tb3", {
    previousReceipt: release.verdict.receipt,
    inventory,
    identityReview: scenario.review(inventory, [
      missingResolution(inventory, label.locator),
    ]),
    planOnly: true,
  });
  assert.deepEqual(codes(acknowledged.plan), ["RELEASED_IDENTITY_UNRESOLVED"]);
  assert.equal(acknowledged.plan.conflicts[0].locator.nodeId, "I10:2;9:99");
  assert.equal(actionFor(acknowledged.plan, "I10:2;9:99"), undefined);
  // 連同新 locator 明示保留後成立;tombstone 記為 node-missing
  const settled = await scenario.sync("tb4", {
    previousReceipt: release.verdict.receipt,
    inventory,
    identityReview: scenario.review(inventory, [
      missingResolution(inventory, label.locator),
      resolutionFor(
        inventory,
        slotOf(inventory, "I10:2;9:99"),
        "preserve-project",
      ),
    ]),
  });
  assert.equal(settled.verdict.status, "verified");
  const receipt = settled.verdict.receipt;
  assert.ok(
    receipt.releasedSlots.some((slot) => slot.reason === "node-missing"),
  );
  // 之後同一 instance 內再重建一次:node-missing 的 tombstone 仍然擋住自動收管
  const again = scenario.world.node(CONSUMER_FILE, {
    ...button.children[0],
    id: "I10:2;9:100",
    fills: [bound(scenario.base.color.contrast)],
  });
  button.children = [];
  button.append(again);
  const later = await scenario.sync("tb5", {
    previousReceipt: receipt,
    planOnly: true,
  });
  assert.ok(codes(later.plan).includes("RELEASED_IDENTITY_UNRESOLVED"));
  assert.equal(actionFor(later.plan, "I10:2;9:100"), undefined);
});

test("adopt-source 的角色:有可靠來源 slot 時只認來源已審的角色,不退回 consumer 現在綁的舊角色", async () => {
  const scenario = await createScenario();
  // consumer 把 Button 的 fill 覆寫成底座的 light;來源 slot 綁的是 main
  scenario.consumer.nodes.button.fills = [bound(scenario.base.color.light)];
  const inventory = await scenario.scanConsumer("role-scan");
  const slot = slotOf(inventory, "10:2");
  assert.equal(slot.value.key, scenario.base.color.light.key);
  assert.equal(
    slot.sourceMatch.sourceSlot.bindingKey,
    scenario.base.color.main.key,
  );
  const plan = (expectedRole) =>
    scenario.sync(`role-${expectedRole}`, {
      inventory,
      identityReview: scenario.review(inventory, [
        resolutionFor(inventory, slot, "adopt-source", expectedRole),
      ]),
      planOnly: true,
    });
  // 冒稱採來源卻指定 consumer 覆寫的角色:不成立
  const wrong = await plan("light");
  assert.deepEqual(codes(wrong.plan), ["RESOLUTION_ROLE_UNCONFIRMED"]);
  assert.equal(actionFor(wrong.plan, "10:2"), undefined);
  // 來源已審的角色才是唯一候選;role 與 source binding 一致
  const right = await plan("main");
  assert.deepEqual(codes(right.plan), []);
  const action = actionFor(right.plan, "10:2");
  assert.equal(action.role, "main");
  assert.equal(action.expectedAfter.key, projectKey(scenario, "main"));
  const managed = right.plan.managedSlots.find(
    (item) =>
      item.locator.nodeId === "10:2" && item.locator.field === "fill-color",
  );
  assert.equal(managed.role, "main");
  assert.equal(managed.source.bindingKey, scenario.base.color.main.key);
  // 想保留與來源不同的角色要走 preserve-project,不是 adopt-source
  const kept = await scenario.sync("role-keep", {
    inventory,
    identityReview: scenario.review(inventory, [
      resolutionFor(inventory, slot, "preserve-project"),
    ]),
    planOnly: true,
  });
  assert.deepEqual(codes(kept.plan), []);
  assert.equal(kept.plan.releasedSlots.length, 1);
  // 沒有 counterpart 的 direct binding(僅 brand-bindings)才以現在綁的已審 key 確認
  const direct = slotOf(inventory, "10:7");
  assert.equal(direct.sourceMatch.sourceSlot, null);
  const adopted = await scenario.sync("role-direct", {
    inventory,
    identityReview: scenario.review(inventory, [
      resolutionFor(inventory, direct, "adopt-source", "main"),
    ]),
    planOnly: true,
  });
  assert.deepEqual(codes(adopted.plan), []);
  assert.equal(actionFor(adopted.plan, "10:7").role, "main");
});
