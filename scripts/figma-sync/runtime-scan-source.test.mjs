import assert from "node:assert/strict";
import { test } from "node:test";

import { BASE_FILE, CONSUMER_FILE, createScenario } from "./test-support.mjs";

const slotOf = (inventory, nodeId, field = "fill-color") =>
  inventory.slots.find(
    (slot) => slot.locator.nodeId === nodeId && slot.locator.field === field,
  );
const codes = (plan) =>
  Array.from(new Set(plan.conflicts.map((conflict) => conflict.code))).sort();
const aliasTo = (variable) => ({ type: "VARIABLE_ALIAS", id: variable.id });

/** consumer 已補套成專案 key(有 receipt)之後,弄壞來源同一把 base key 的 alias。 */
async function patchedThenBroken(breakSource) {
  const scenario = await createScenario();
  const first = await scenario.sync("s1");
  const { color } = scenario.base;
  const modeId = Object.keys(color.main.valuesByMode)[0];
  breakSource(scenario, color.main, modeId);
  const next = await scenario.sync("s2", {
    previousReceipt: first.verdict.receipt,
    planOnly: true,
  });
  return { scenario, first, next, slot: slotOf(next.inventory, "10:2") };
}

for (const [label, expected, breakSource] of [
  [
    "alias cycle",
    "SOURCE_ALIAS_CYCLE",
    (scenario, main, modeId) => (main.valuesByMode[modeId] = aliasTo(main)),
  ],
  [
    "缺 mode",
    "SOURCE_ALIAS_MODE_MISSING",
    (scenario, main, modeId) => delete main.valuesByMode[modeId],
  ],
  [
    "缺 alias 目標",
    "SOURCE_ALIAS_TARGET_MISSING",
    (scenario, main, modeId) =>
      (main.valuesByMode[modeId] = {
        type: "VARIABLE_ALIAS",
        id: "VariableID:gone",
      }),
  ],
]) {
  test(`來源端 ${label}:consumer 自己的鏈正常也不能把來源當成已驗`, async () => {
    const { first, next, slot } = await patchedThenBroken(breakSource);
    // consumer 綁的是專案 key,它自己的 alias 鏈與顏色完全正常
    assert.equal(
      slot.value.key,
      first.verdict.receipt.managedSlots[0].lastWrittenValue.key,
    );
    assert.equal(slot.resolvedValue.kind, "rgba");
    // 來源解析失敗沒有被吞掉:對照 unresolved、保留已讀到的鏈、另列 issue
    assert.equal(slot.sourceMatch.status, "unresolved");
    assert.equal(slot.sourceMatch.reason, expected);
    assert.notEqual(slot.sourceMatch.sourceSlot, null);
    assert.ok(slot.sourceMatch.sourceSlot.aliasChain.length >= 1);
    const issue = next.inventory.issues.find(
      (item) => item.code === expected && item.locator.nodeId === "10:2",
    );
    assert.equal(issue.assetKey, slot.sourceMatch.sourceSlot.bindingKey);
    // 規劃 blocked、零 action;不會沿用舊登記輸出成功
    assert.equal(next.plan.status, "blocked");
    assert.deepEqual(next.plan.actions, []);
    assert.ok(codes(next.plan).includes("SOURCE_MATCH_UNSUPPORTED"));
    assert.ok(codes(next.plan).includes(expected));
  });
}

test("來源節點的 effect style 讀不到:不當成來源沒有綁定", async () => {
  const scenario = await createScenario();
  const first = await scenario.sync("st1");
  scenario.world.styles.delete(scenario.base.shadow.id);
  const next = await scenario.sync("st2", {
    previousReceipt: first.verdict.receipt,
    planOnly: true,
  });
  const slot = slotOf(next.inventory, "10:2", "effect-style");
  assert.equal(slot.sourceMatch.status, "unresolved");
  assert.equal(slot.sourceMatch.reason, "SOURCE_STYLE_MISSING");
  assert.equal(slot.sourceMatch.sourceSlot.bindingKey, null);
  assert.equal(next.plan.status, "blocked");
  assert.ok(codes(next.plan).includes("SOURCE_STYLE_MISSING"));
});

test("來源正常時:sourceSlot 帶 binding key 與依 consumer mode 解析的 alias 鏈,沒有 issue", async () => {
  const scenario = await createScenario();
  const inventory = await scenario.scanConsumer("ok-1");
  const { color, brand } = scenario.base;
  const slot = slotOf(inventory, "10:2");
  assert.deepEqual(inventory.issues, []);
  assert.equal(slot.sourceMatch.status, "exact-root");
  assert.equal(slot.sourceMatch.sourceSlot.bindingKey, color.main.key);
  assert.deepEqual(
    slot.sourceMatch.sourceSlot.aliasChain.map((step) => step.variableKey),
    [color.main.key, brand.main.key],
  );
  // 沒有綁定的來源 paint:binding 為 null、鏈為空,不是錯誤
  const label = slotOf(inventory, "I10:8;1:16");
  assert.deepEqual(label.sourceMatch.sourceSlot, {
    field: "fill-color",
    index: 0,
    bindingKey: null,
    aliasChain: [],
  });
  assert.ok(BASE_FILE && CONSUMER_FILE);
});
