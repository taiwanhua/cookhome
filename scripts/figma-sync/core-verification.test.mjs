import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BASE_FILE,
  CONSUMER_FILE,
  contract,
  core,
  createScenario,
} from "./test-support.mjs";

const clone = (value) => structuredClone(value);
const errorCodes = (verdict) =>
  Array.from(new Set(verdict.verification.errors.map((error) => error.code)));
const done = await (async () => {
  const scenario = await createScenario();
  const run = await scenario.sync("v1");
  return { scenario, run };
})();
/** 以同一份 plan / before 重驗被改過的 runtime 回傳。 */
const verifyWith = (change) => {
  const attempt = clone(done.run.attempt);
  change(attempt.afterInventory, attempt);
  return core.verifySync({
    plan: done.run.plan,
    beforeInventory: done.run.inventory,
    afterInventory: attempt.afterInventory,
    previousReceipt: null,
    attempt,
  });
};
const firstAction = done.run.plan.actions[0];
const actionSlot = (inventory) =>
  inventory.slots.find(
    (slot) =>
      contract.slotKey(slot.locator) === contract.slotKey(firstAction.locator),
  );

test("成功 receipt:累積受管 slots、精驗結果與來源證據,不存場景文案", () => {
  const { plan, verdict, attempt, inventory } = done.run;
  assert.equal(verdict.status, "verified");
  const receipt = verdict.receipt;
  assert.equal(receipt.kind, "receipt");
  assert.equal(receipt.status, "verified");
  assert.equal(receipt.verifiedFor, "brand-bindings");
  assert.equal(receipt.targetFileKey, CONSUMER_FILE);
  assert.equal(receipt.runId, "v1");
  assert.equal(receipt.generatedAt, attempt.generatedAt);
  assert.equal(receipt.planDigest, contract.digest(plan));
  assert.equal(receipt.beforeDigest, contract.digest(inventory));
  assert.equal(receipt.afterDigest, contract.digest(attempt.afterInventory));
  assert.equal(receipt.previousReceiptDigest, null);
  assert.equal(receipt.publicationEvidence, null);
  assert.equal(receipt.identityMap.length, 13);
  assert.equal(receipt.identityReviewDigest, plan.inputDigests.identityReview);
  assert.equal(receipt.brand.inputDigest, plan.project.brandInputDigest);
  assert.equal(receipt.managedSlots.length, plan.actions.length);
  for (const slot of receipt.managedSlots) {
    assert.equal(slot.firstManagedRunId, "v1");
    assert.equal(slot.lastVerifiedRunId, "v1");
    assert.deepEqual(slot.verifiedValue, slot.lastWrittenValue);
    assert.equal(slot.source.fileKey, BASE_FILE);
    assert.equal(slot.source.nodeContextFileKey, CONSUMER_FILE);
  }
  // 祖先來源鏈完整保存,不只留最後的 nearest main
  const nested = receipt.managedSlots.find(
    (slot) => slot.locator.nodeId === "I10:6;1:55",
  );
  assert.equal(nested.source.ancestryPath.length, 3);
  assert.equal(nested.source.sourceNodeId, "1:55");
  assert.deepEqual(receipt.changes, {
    planned: 15,
    applied: 15,
    recoveredAlreadyApplied: 0,
    createdAssets: 0,
    // 五把 Color 變數(main / dark / contrast / lighter / light)與一個 Shadow/Primary
    importedAssets: 6,
  });
  assert.deepEqual(
    { ...receipt.verification, coverage: null },
    {
      exactColors: 12,
      exactPrimaryEffects: 3,
      remainingBaseBrandSlots: 0,
      sourceKeysPreserved: true,
      brokenInstances: 0,
      protectedChanges: 0,
      outsideScopeChanges: 0,
      unresolved: 0,
      unsupported: 0,
      coverage: null,
      sourceSemanticCoverage: {
        managed: 15,
        withSourceSlot: 14,
        directBinding: 1,
      },
      errors: [],
    },
  );
  // 持久狀態只留補套必需的 slot 身分;文字等 protected 內容留在暫存 inventory
  const text = JSON.stringify(receipt);
  assert.ok(JSON.stringify(inventory).includes("自訂文字"));
  assert.ok(!text.includes("自訂文字"));
  assert.ok(!text.includes("characters"));
  assert.ok(!text.includes("hash-logo"));
});

test("不信任 runtime 自報成功:after 與 plan 不符就沒有 receipt", () => {
  // 回傳 applied,但實際值仍是底座 key
  const lying = verifyWith((after) => {
    const slot = actionSlot(after);
    slot.value = clone(firstAction.before);
  });
  assert.equal(lying.status, "failed");
  assert.equal(lying.receipt, null);
  assert.ok(errorCodes(lying).includes("MANAGED_VALUE_MISMATCH"));
  assert.ok(errorCodes(lying).includes("BASE_BRAND_REMAINING"));
  assert.equal(lying.verification.remainingBaseBrandSlots, 1);

  const failed = verifyWith(
    (after, attempt) => (attempt.status = "interrupted"),
  );
  assert.deepEqual(errorCodes(failed), ["ATTEMPT_NOT_APPLIED"]);
  assert.equal(failed.receipt, null);

  const skipped = verifyWith((after, attempt) =>
    attempt.completedActions.pop(),
  );
  assert.deepEqual(errorCodes(skipped), ["ACTION_NOT_COMPLETED"]);

  const otherPlan = verifyWith(
    (after, attempt) => (attempt.planDigest = contract.digest("other")),
  );
  assert.deepEqual(errorCodes(otherPlan), ["ATTEMPT_PLAN_MISMATCH"]);

  const otherFile = verifyWith((after) => (after.observedFileKey = BASE_FILE));
  assert.deepEqual(errorCodes(otherFile), ["SCOPE_MISMATCH"]);
});

test("精確色:容差固定 1e-6,不只比 key 或 HEX", () => {
  const within = verifyWith((after) => {
    actionSlot(after).resolvedValue.rgba.r += 5e-7;
  });
  assert.equal(within.status, "verified");
  const beyond = verifyWith((after) => {
    actionSlot(after).resolvedValue.rgba.r += 1e-3;
  });
  assert.deepEqual(errorCodes(beyond), ["MANAGED_VALUE_MISMATCH"]);

  const shadow = (after) =>
    after.slots.find(
      (slot) =>
        slot.locator.nodeId === "10:2" && slot.locator.field === "effect-style",
    );
  for (const tamper of [
    (effect) => (effect.color.a = 1),
    (effect) => (effect.offset.y += 1),
    (effect) => (effect.radius += 1),
    (effect) => (effect.spread = 2),
    (effect) => (effect.visible = false),
    (effect) => (effect.blendMode = "MULTIPLY"),
    (effect) => (effect.type = "INNER_SHADOW"),
  ]) {
    const verdict = verifyWith((after) =>
      tamper(shadow(after).resolvedValue.effects[0]),
    );
    assert.deepEqual(errorCodes(verdict), ["MANAGED_VALUE_MISMATCH"]);
  }
});

test("protected 欄位與 scope 外控制值:任何非本次 action 的改變都擋下(含沒有 slot 的節點)", () => {
  const node = (after, nodeId) =>
    after.nodes.find((item) => item.nodeId === nodeId);
  const slotOf = (after, nodeId, field = "fill-color") =>
    after.slots.find(
      (slot) => slot.locator.nodeId === nodeId && slot.locator.field === field,
    );
  // SideNav 內的 icon instance 沒有任何可補套的 slot,仍有自己的 node 觀測
  assert.equal(slotOf(done.run.inventory, "I10:5;1:44"), undefined);
  assert.ok(node(done.run.inventory, "I10:5;1:44"));
  for (const tamper of [
    (after) =>
      (node(after, "I10:3;1:11").protectedSnapshot.characters = "被改掉"),
    (after) => (node(after, "I10:3;1:11").protectedSnapshot.visible = false),
    (after) => (node(after, "10:2").protectedSnapshot.geometry.width += 1),
    (after) => (node(after, "10:7").protectedSnapshot.fills[0].imageHash = "x"),
    (after) => (node(after, "10:7").protectedSnapshot.fills[1].opacity = 1),
    // 沒有 slot 的節點:visible、nested main(swap)、幾何
    (after) => (node(after, "I10:5;1:44").protectedSnapshot.visible = false),
    (after) =>
      (node(after, "I10:5;1:44").protectedSnapshot.mainComponentKey = "other"),
    (after) => (node(after, "10:1").protectedSnapshot.geometry.height += 4),
    (after) =>
      after.nodes.splice(after.nodes.indexOf(node(after, "I10:5;1:44")), 1),
    (after) => node(after, "10:6").ancestorIds.unshift("99:9"),
    // 非 action 的 slot:值、alias 鏈、解析結果、來源對照
    (after) => (slotOf(after, "10:3").value.rgba.r = 0),
    (after) => (slotOf(after, "10:4").resolvedValue = null),
    (after) => slotOf(after, "10:4").aliasChain.pop(),
    (after) => (slotOf(after, "I10:8;1:16").sourceMatch.sourceNodeId = "other"),
    (after) =>
      after.slots.splice(after.slots.indexOf(slotOf(after, "10:3")), 1),
  ]) {
    const verdict = verifyWith(tamper);
    assert.ok(
      errorCodes(verdict).includes("PROTECTED_CHANGED"),
      errorCodes(verdict),
    );
    assert.ok(verdict.verification.protectedChanges >= 1);
    assert.equal(verdict.receipt, null);
  }
  const outsideNode = (after) =>
    after.nodes.find((item) => item.scopeRootId === null);
  for (const tamper of [
    (after) =>
      (slotOf(after, outsideNode(after).nodeId).value = {
        kind: "fixed",
        rgba: { r: 1, g: 0, b: 0, a: 1 },
      }),
    (after) => (outsideNode(after).protectedSnapshot.visible = false),
  ]) {
    const outside = verifyWith(tamper);
    assert.deepEqual(errorCodes(outside), ["OUTSIDE_SCOPE_CHANGED"]);
    assert.equal(outside.verification.outsideScopeChanges, 1);
  }
});

test("輸入快照固定:before 或 previous receipt 與 plan 記錄的 digest 不符即失敗", () => {
  const { plan, attempt, inventory, verdict } = done.run;
  const otherBefore = clone(inventory);
  otherBefore.runId = "other";
  const wrongBefore = core.verifySync({
    plan,
    beforeInventory: otherBefore,
    afterInventory: attempt.afterInventory,
    previousReceipt: null,
    attempt,
  });
  assert.deepEqual(errorCodes(wrongBefore), ["BEFORE_INVENTORY_MISMATCH"]);
  const wrongPrevious = core.verifySync({
    plan,
    beforeInventory: inventory,
    afterInventory: attempt.afterInventory,
    previousReceipt: verdict.receipt,
    attempt,
  });
  assert.deepEqual(errorCodes(wrongPrevious), ["PREVIOUS_RECEIPT_MISMATCH"]);
});

test("累積 receipt:小範圍成功只更新該範圍,scope 外登記原樣保留", async () => {
  const scenario = await createScenario();
  const first = await scenario.sync("a1", { roots: ["10:2"] });
  assert.equal(first.verdict.status, "verified");
  assert.equal(first.verdict.receipt.managedSlots.length, 4);
  const second = await scenario.sync("a2", {
    roots: ["10:5"],
    previousReceipt: first.verdict.receipt,
  });
  assert.equal(second.verdict.status, "verified");
  const receipt = second.verdict.receipt;
  assert.deepEqual(receipt.lastRunScope.rootNodeIds, ["10:5"]);
  assert.equal(
    receipt.previousReceiptDigest,
    contract.digest(first.verdict.receipt),
  );
  const byRun = (runId) =>
    receipt.managedSlots.filter((slot) => slot.lastVerifiedRunId === runId);
  assert.equal(byRun("a1").length, 4);
  assert.ok(
    byRun("a1").every((slot) => slot.locator.rootInstanceId === "10:2"),
  );
  assert.equal(byRun("a2").length, 3);
  assert.equal(receipt.managedSlots.length, 7);
  assert.equal(receipt.verification.exactColors, 3);
  // 再回到第一個範圍:同狀態重跑零修改,兩個範圍的登記都還在
  const third = await scenario.sync("a3", {
    roots: ["10:2"],
    previousReceipt: receipt,
  });
  assert.equal(third.plan.status, "noop");
  assert.equal(third.verdict.status, "verified");
  assert.equal(third.verdict.receipt.managedSlots.length, 7);
  assert.equal(
    third.verdict.receipt.managedSlots.filter(
      (slot) => slot.lastVerifiedRunId === "a2",
    ).length,
    3,
  );
});

test("library-upgrade 需要接受證據與完整來源語意;brand-bindings 不會輸出 library-upgrade", async () => {
  const scenario = await createScenario();
  const keys = Object.values(scenario.base.components).map((item) => item.key);
  const options = {
    roots: ["10:2"],
    verificationTarget: "library-upgrade",
    publicationEvidence: {
      baseGitTag: "v1.2.0",
      baseGitCommit: "b".repeat(40),
      sourceFileKey: BASE_FILE,
      label: "v1.2.0",
      versionId: "2406190621933543234",
      versionUrl:
        "https://www.figma.com/design/x?version-id=2406190621933543234",
      observedAt: "2026-01-02T00:00:00Z",
      changedAssetKeys: keys,
    },
    acceptanceEvidence: {
      sourceFileKey: BASE_FILE,
      consumerFileKey: CONSUMER_FILE,
      observedAt: "2026-01-02T01:00:00Z",
      acceptedAssetKeys: keys,
      pageIds: [],
      rootNodeIds: ["10:2"],
      scope: "listed-scope",
      evidenceUrl: "https://github.com/acme/widgets/issues/2",
    },
  };
  const upgrade = await scenario.sync("l1", options);
  assert.equal(upgrade.verdict.status, "verified");
  assert.equal(upgrade.verdict.receipt.verifiedFor, "library-upgrade");
  assert.deepEqual(
    upgrade.verdict.receipt.acceptanceEvidence,
    options.acceptanceEvidence,
  );
  assert.equal(
    upgrade.verdict.receipt.verification.sourceSemanticCoverage.directBinding,
    0,
  );
  assert.equal(done.run.verdict.receipt.verifiedFor, "brand-bindings");
  assert.equal(done.run.verdict.receipt.acceptanceEvidence, null);
});

test("after 的來源語意必須等於 plan 封存的證據:binding、alias 鏈、祖先鏈任何一項變了都不發 receipt", () => {
  const find = (after, nodeId) =>
    after.slots.find(
      (slot) =>
        slot.locator.nodeId === nodeId && slot.locator.field === "fill-color",
    );
  for (const [nodeId, tamper] of [
    // 寫入後、after 掃描前來源由 main 改成 light:consumer 的色與 key 都還符合舊 plan
    ["10:2", (slot) => (slot.sourceMatch.sourceSlot.bindingKey = "other-key")],
    [
      "10:2",
      (slot) =>
        (slot.sourceMatch.sourceSlot.aliasChain[0].aliasTargetKey = "other"),
    ],
    ["10:2", (slot) => (slot.sourceMatch.sourceNodeId = "9:9")],
    ["10:2", (slot) => (slot.sourceMatch.sourceSlot = null)],
    [
      "I10:6;1:55",
      (slot) => (slot.sourceMatch.ancestryPath[1].sourceChildCount += 1),
    ],
    [
      "I10:6;1:55",
      (slot) => (slot.sourceMatch.ancestryPath[0].sourceParentId = "9:9"),
    ],
  ]) {
    const verdict = verifyWith((after) => tamper(find(after, nodeId)));
    assert.equal(verdict.status, "failed");
    assert.equal(verdict.receipt, null);
    assert.ok(
      errorCodes(verdict).includes("SOURCE_SEMANTICS_CHANGED"),
      errorCodes(verdict),
    );
    assert.equal(verdict.verification.unresolved, 1);
  }
  // 專案變數的 key 沒變、解析出的顏色也一樣,但 alias 改指了別的終點
  const realiased = verifyWith(
    (after) => (find(after, "10:2").aliasChain[0].aliasTargetKey = "other"),
  );
  assert.deepEqual(errorCodes(realiased), ["PROJECT_ALIAS_CHANGED"]);
  assert.equal(
    done.run.verdict.receipt.verification.sourceSemanticCoverage.withSourceSlot,
    14,
  );
});

test("所驗的 after 必須是 attempt 內嵌、同一輪 run 的掃描", () => {
  const { plan, attempt, inventory } = done.run;
  const verify = (afterInventory, attemptValue = attempt) =>
    core.verifySync({
      plan,
      beforeInventory: inventory,
      afterInventory,
      previousReceipt: null,
      attempt: attemptValue,
    });
  // 另一份內容恰好合理的舊掃描,不是這份 attempt 帶回來的
  const other = clone(attempt.afterInventory);
  other.coverage.hiddenNodes += 1;
  assert.deepEqual(errorCodes(verify(other)), ["AFTER_INVENTORY_MISMATCH"]);
  // 封存時補上的 digest 與實際內容不符
  const mislabeled = { ...attempt, afterInventoryDigest: contract.digest("x") };
  assert.deepEqual(errorCodes(verify(attempt.afterInventory, mislabeled)), [
    "AFTER_INVENTORY_MISMATCH",
  ]);
  // 內嵌的 after 來自別的 run / project / tool:連協定驗證都不過
  for (const change of [
    (after) => (after.runId = "another-run"),
    (after) => (after.project.repository = "other/repo"),
    (after) => (after.tool.sourceDigest = contract.digest("other-tool")),
  ]) {
    // runtime 回傳的 attempt 與內嵌 after 共用同一個 header 物件;以 JSON 往返取得各自獨立的複本
    const spliced = JSON.parse(JSON.stringify(attempt));
    change(spliced.afterInventory);
    assert.throws(
      () => verify(spliced.afterInventory, spliced),
      (error) => error.code === "ARTIFACT_INVALID",
    );
  }
  assert.equal(verify(attempt.afterInventory).status, "verified");
});

test("after 的 alias 錯誤與全域掃描問題不會被忽略後標記成功", () => {
  const locatorOf = (after, nodeId) =>
    after.slots.find((slot) => slot.locator.nodeId === nodeId).locator;
  // 範圍內未受管的私有變數在 after 變成 alias cycle:key 與 snapshot 都沒變
  const cycle = verifyWith((after) =>
    after.issues.push({
      code: "ALIAS_CYCLE",
      locator: locatorOf(after, "10:4"),
      assetKey: "private",
      detail: "",
    }),
  );
  assert.deepEqual(errorCodes(cycle), ["AFTER_ISSUE"]);
  assert.equal(cycle.verification.unresolved, 1);
  assert.equal(cycle.receipt, null);
  for (const issue of [
    { code: "CAPABILITY_MISSING", detail: "variablesReadable" },
    { code: "ROOT_NOT_FOUND", detail: "" },
  ]) {
    const verdict = verifyWith((after) => after.issues.push(issue));
    assert.deepEqual(errorCodes(verdict), ["AFTER_ISSUE"]);
  }
  const identityKey = done.run.plan.identityMap[0].project.key;
  const unsupported = verifyWith((after) =>
    after.issues.push({
      code: "UNSUPPORTED_BINDING",
      locator: locatorOf(after, "10:7"),
      assetKey: identityKey,
      detail: "",
    }),
  );
  assert.deepEqual(errorCodes(unsupported), ["AFTER_ISSUE"]);
  assert.equal(unsupported.verification.unsupported, 1);
});
