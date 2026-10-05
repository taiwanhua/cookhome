import assert from "node:assert/strict";
import { test } from "node:test";

import { createFigmaBrandProjection } from "./brand.mjs";
import {
  BASE_FILE,
  CONSUMER_FILE,
  bound,
  brandFixture,
  contract,
  createScenario,
  fixed,
} from "./test-support.mjs";

const slotOf = (inventory, nodeId, field = "fill-color", index = 0) =>
  inventory.slots.find(
    (slot) =>
      slot.locator.nodeId === nodeId &&
      slot.locator.field === field &&
      slot.locator.index === (field === "effect-style" ? null : index),
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
const projectKey = (scenario, role, side = "Color") =>
  scenario.brandReceipt.managedAssets.find(
    (asset) =>
      asset.kind === "variable" &&
      asset.role === role &&
      asset.collectionRole === side,
  ).key;
const evidence = (scenario, overrides = {}) => {
  const keys = Object.values(scenario.base.components).map((item) => item.key);
  return {
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
      ...overrides.publication,
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
      ...overrides.acceptance,
    },
  };
};

test("首次規劃:只改已審查的底座品牌綁定,客製與非品牌語意保留", async () => {
  const scenario = await createScenario();
  const { plan, inventory } = await scenario.sync("p1", { planOnly: true });
  assert.equal(plan.status, "ready");
  assert.deepEqual(plan.conflicts, []);
  // Button:fill=main、stroke=dark、文字=contrast、陰影=primary-shadow
  assert.equal(actionFor(plan, "10:2").role, "main");
  assert.equal(actionFor(plan, "10:2", "stroke-color").role, "dark");
  assert.equal(actionFor(plan, "10:2", "effect-style").role, "primary-shadow");
  assert.equal(
    actionFor(plan, "10:2").params.variableRef.key,
    projectKey(scenario, "main"),
  );
  assert.deepEqual(actionFor(plan, "10:2").expectedAfter, {
    kind: "variable",
    key: projectKey(scenario, "main"),
  });
  // 手動自訂色與「HEX 同底座主色」的專案私有變數都不動,只列保留
  assert.equal(actionFor(plan, "10:3"), undefined);
  assert.equal(actionFor(plan, "10:4"), undefined);
  assert.deepEqual(
    plan.preserved.map((item) => [item.locator.nodeId, item.reason]),
    [
      ["10:3", "custom-fixed-color"],
      ["10:4", "project-private-binding"],
    ],
  );
  // 自訂色按鈕的 stroke / 陰影 / 文字仍是底座品牌,照樣補套
  assert.equal(actionFor(plan, "10:3", "stroke-color").role, "dark");
  // Error 按鈕(error 色、Card 陰影)不是品牌語意,沒有任何 action
  assert.equal(
    plan.actions.filter((action) => action.locator.rootInstanceId === "10:8")
      .length,
    0,
  );
  // 圖片節點:IMAGE paint 不是 slot;第二個 fill 直接綁底座 key(不在 instance 內)
  const direct = actionFor(plan, "10:7");
  assert.equal(direct.locator.index, 1);
  assert.equal(direct.sourceEvidence.sourceMatch.reason, "NOT_IN_INSTANCE");
  assert.equal(
    plan.managedSlots.find((slot) => slot.locator.nodeId === "10:7")
      .sourceMatchStatus,
    "direct-binding",
  );
  // 每筆 action 都帶 before / guards,證據複本補上 consumer digest、raw digest 不變
  for (const action of plan.actions) {
    const slot = inventory.slots.find(
      (item) =>
        contract.slotKey(item.locator) === contract.slotKey(action.locator),
    );
    assert.deepEqual(action.before, slot.value);
    assert.equal(
      action.preconditions.sourceMatchDigest,
      contract.digest(slot.sourceMatch),
    );
    assert.equal(
      action.sourceEvidence.sourceMatchDigest,
      contract.digest(slot.sourceMatch),
    );
    assert.equal(
      action.sourceEvidence.sourceMatch.consumerInventoryDigest,
      contract.digest(inventory),
    );
    assert.equal(action.sourceEvidence.sourceMatch.sourceInventoryDigest, null);
  }
  assert.equal(plan.managedSlots.length, plan.actions.length);
  assert.equal(plan.verification.target, "brand-bindings");
});

test("祖先 source instance context:巢狀來源覆寫、隱藏槽與 swap 都對到正確語意", async () => {
  const scenario = await createScenario();
  const { plan, inventory } = await scenario.sync("p2", { planOnly: true });
  const { base } = scenario;
  // SideNav 內的 NavItem:孤立 master 是固定色,來源 instance 覆寫成 primary/lighter
  const active = slotOf(inventory, "I10:5;1:41");
  assert.equal(active.sourceMatch.status, "validated-structure");
  assert.equal(active.sourceMatch.sourceNodeId, "1:41");
  assert.equal(
    active.sourceMatch.sourceSlot.bindingKey,
    base.color.lighter.key,
  );
  assert.equal(
    active.sourceMatch.ancestryPath[0].nestedComponentKey,
    base.components.navItem.key,
  );
  assert.equal(actionFor(plan, "I10:5;1:41").role, "lighter");
  // 隱藏的備用槽照樣檢查
  assert.equal(
    slotOf(inventory, "I10:5;1:42").protectedSnapshot.visible,
    false,
  );
  assert.equal(actionFor(plan, "I10:5;1:42").role, "light");
  // 使用者 swap 成 Icon/B:來源範圍改為 B 的 master(dark),不是原來 A 的 main
  const swapped = inventory.slots.find(
    (slot) =>
      slot.locator.rootInstanceId === "10:5" &&
      slot.sourceMatch.sourceNodeId === "1:26",
  );
  assert.equal(swapped.sourceMatch.sourceSlot.bindingKey, base.color.dark.key);
  assert.deepEqual(swapped.observedOverrides[0], {
    kind: "instance-swap",
    nodeId: "I10:5;1:44",
    sourceComponentKey: base.components.iconA.key,
    consumerComponentKey: base.components.iconB.key,
  });
  assert.equal(
    plan.actions.find(
      (action) => action.locator.nodeId === swapped.locator.nodeId,
    ).role,
    "dark",
  );
  // Dialog dot 在 child-index 路徑 [1,0,1]
  const dot = slotOf(inventory, "I10:6;1:55");
  assert.deepEqual(
    dot.sourceMatch.ancestryPath.map((step) => step.childIndex),
    [1, 0, 1],
  );
  assert.equal(dot.sourceMatch.sourceSlot.bindingKey, base.color.light.key);
});

test("角色漂移:來源由 main 改 light,現值等於上次工具值仍列 SOURCE_ROLE_DRIFT", async () => {
  const scenario = await createScenario();
  const first = await scenario.sync("d1");
  const previousReceipt = first.verdict.receipt;
  scenario.base.components.button.fills = [bound(scenario.base.color.light)];

  const blocked = await scenario.sync("d2", {
    previousReceipt,
    planOnly: true,
  });
  assert.equal(blocked.plan.status, "blocked");
  // 範圍內三顆 Button 實例的 fill 來源都變了;其中兩顆是保留的客製,不在受管範圍
  assert.deepEqual(codes(blocked.plan), ["SOURCE_ROLE_DRIFT"]);
  const conflict = blocked.plan.conflicts[0];
  assert.equal(conflict.locator.nodeId, "10:2");
  assert.equal(conflict.expected.role, "main");
  assert.equal(conflict.resolutionRequired, true);

  // 採來源:必須指定已審語意且與目前來源相符
  const inventory = blocked.inventory;
  const slot = slotOf(inventory, "10:2");
  assert.equal(
    conflict.observed.sourceMatchDigest,
    contract.digest(slot.sourceMatch),
  );
  const wrong = scenario.review(inventory, [
    resolutionFor(inventory, slot, "adopt-source", "dark"),
  ]);
  const unconfirmed = await scenario.sync("d3", {
    previousReceipt,
    inventory,
    identityReview: wrong,
    planOnly: true,
  });
  assert.deepEqual(codes(unconfirmed.plan), ["RESOLUTION_ROLE_UNCONFIRMED"]);

  const adopt = scenario.review(inventory, [
    resolutionFor(inventory, slot, "adopt-source", "light"),
  ]);
  const fixedRun = await scenario.sync("d4", {
    previousReceipt,
    inventory,
    identityReview: adopt,
  });
  assert.equal(fixedRun.plan.actions.length, 1);
  assert.equal(fixedRun.plan.actions[0].role, "light");
  assert.equal(fixedRun.verdict.status, "verified");
  const managed = fixedRun.verdict.receipt.managedSlots.find(
    (item) => contract.slotKey(item.locator) === contract.slotKey(slot.locator),
  );
  assert.equal(managed.role, "light");
  assert.equal(managed.lastWrittenValue.key, projectKey(scenario, "light"));
  assert.equal(managed.firstManagedRunId, "d1");
});

test("保留專案:slot 釋出受管範圍並累積,之後不自動收回,只有 adopt-source 能收管", async () => {
  const scenario = await createScenario();
  const first = await scenario.sync("r1");
  scenario.base.components.button.fills = [bound(scenario.base.color.light)];
  const inventory = await scenario.scanConsumer("r2-scan");
  const slot = slotOf(inventory, "10:2");
  const release = await scenario.sync("r2", {
    previousReceipt: first.verdict.receipt,
    inventory,
    identityReview: scenario.review(inventory, [
      resolutionFor(inventory, slot, "preserve-project"),
    ]),
  });
  assert.equal(release.plan.status, "noop");
  assert.equal(release.verdict.status, "verified");
  const receipt = release.verdict.receipt;
  assert.equal(
    receipt.managedSlots.length,
    first.verdict.receipt.managedSlots.length - 1,
  );
  assert.equal(receipt.releasedSlots.length, 1);
  assert.deepEqual(receipt.releasedSlots[0], {
    locator: slot.locator,
    scopeEvidence: {
      pageId: scenario.consumer.page.id,
      scopeRootId: "10:1",
      ancestorIds: ["10:1", scenario.consumer.page.id],
    },
    previousReceiptDigest: contract.digest(first.verdict.receipt),
    resolutionEvidenceURL: "https://github.com/acme/widgets/issues/1",
    reason: "preserve-project",
    reviewedValue: slot.value,
    sourceMatchDigest: contract.digest(slot.sourceMatch),
    releasedRunId: "r2",
  });

  // 釋出後即使改回綁底座 key,也不自動重新收管
  scenario.consumer.nodes.button.fills = [bound(scenario.base.color.main)];
  const later = await scenario.sync("r3", { previousReceipt: receipt });
  assert.equal(later.plan.status, "noop");
  assert.equal(actionFor(later.plan, "10:2"), undefined);
  assert.ok(
    later.plan.preserved.some(
      (item) => item.locator.nodeId === "10:2" && item.reason === "released",
    ),
  );
  assert.equal(later.verdict.receipt.releasedSlots.length, 1);

  // 綁定新掃描、實際值與來源 guards 的 adopt-source 才收回
  const rescan = await scenario.scanConsumer("r4-scan");
  const current = slotOf(rescan, "10:2");
  const readopt = await scenario.sync("r4", {
    previousReceipt: later.verdict.receipt,
    inventory: rescan,
    identityReview: scenario.review(rescan, [
      resolutionFor(rescan, current, "adopt-source", "light"),
    ]),
  });
  assert.equal(readopt.verdict.status, "verified");
  assert.equal(readopt.verdict.receipt.releasedSlots.length, 0);
  assert.equal(actionFor(readopt.plan, "10:2").role, "light");
});

test("已受管值被人工改動、節點消失:都要明示決定,不默默清登記", async () => {
  const scenario = await createScenario();
  const first = await scenario.sync("m1");
  const previousReceipt = first.verdict.receipt;
  scenario.consumer.nodes.button.fills = [fixed({ r: 0, g: 0, b: 0 })];
  const dialog = scenario.consumer.nodes.dialog;
  scenario.consumer.root.children = scenario.consumer.root.children.filter(
    (node) => node !== dialog,
  );
  const sideNav = scenario.consumer.nodes.sideNav;
  sideNav.children = sideNav.children.filter(
    (node) => node.id !== "I10:5;1:42",
  );

  const blocked = await scenario.sync("m2", {
    previousReceipt,
    planOnly: true,
  });
  // 被拿掉一個 child 的 SideNav 與來源結構不再相符:其餘受管 slot 沒有可靠來源對照
  assert.deepEqual(Array.from(new Set(codes(blocked.plan))), [
    "MANAGED_SLOT_MISSING",
    "MANAGED_VALUE_CHANGED",
    "SOURCE_MATCH_UNSUPPORTED",
  ]);
  assert.ok(
    blocked.inventory.slots.some(
      (slot) => slot.sourceMatch.reason === "STRUCTURE_MISMATCH",
    ),
  );
  // 登記仍完整保留(blocked plan 不會寫成功狀態)
  assert.equal(
    blocked.plan.managedSlots.length,
    previousReceipt.managedSlots.length,
  );
  // 整個 root instance 消失的 Dialog:無法判定是否在本次範圍,原樣保留舊登記、不假裝本輪已驗
  const dot = blocked.plan.managedSlots.find(
    (slot) => slot.locator.nodeId === "I10:6;1:55",
  );
  assert.equal(dot.lastVerifiedRunId, "m1");
});

test("來源重建:同名同形的新圖層不自動認養,列 SOURCE_IDENTITY_CHANGED", async () => {
  const scenario = await createScenario();
  const first = await scenario.sync("s1");
  const { button } = scenario.base.components;
  const label = button.children[0];
  // 刪除重建元件內圖層:型別、位置、名稱、綁定都相同,只有節點身分是新的
  const rebuilt = scenario.world.node(BASE_FILE, {
    ...label,
    id: "1:99",
    fills: label.fills,
  });
  button.children = [];
  button.append(rebuilt);
  const { plan } = await scenario.sync("s2", {
    previousReceipt: first.verdict.receipt,
    planOnly: true,
  });
  assert.equal(plan.status, "blocked");
  assert.deepEqual(Array.from(new Set(codes(plan))), [
    "SOURCE_IDENTITY_CHANGED",
  ]);
  assert.ok(
    plan.conflicts.every((conflict) => /;1:11$/.test(conflict.locator.nodeId)),
  );
});

test("無法辨認或未支援的綁定不靜默略過", async (t) => {
  await t.test("未知來源的變數 → UNKNOWN_ASSET", async () => {
    const scenario = await createScenario();
    scenario.world.addFile("THIRDfile01");
    const collection = scenario.world.addCollection("THIRDfile01", "Other", [
      "Light",
    ]);
    const foreign = scenario.world.addVariable("THIRDfile01", "x", collection);
    scenario.consumer.nodes.button.fills = [bound(foreign)];
    const { plan } = await scenario.sync("u1", { planOnly: true });
    assert.deepEqual(codes(plan), ["UNKNOWN_ASSET"]);
  });
  await t.test(
    "paint 數量與來源不同 → PAINT_SHAPE_CONFLICT,不硬配 index",
    async () => {
      const scenario = await createScenario();
      const { button } = scenario.consumer.nodes;
      button.fills = [fixed(), ...button.fills];
      const { plan, inventory } = await scenario.sync("u2", { planOnly: true });
      assert.deepEqual(codes(plan), ["PAINT_SHAPE_CONFLICT"]);
      assert.deepEqual(
        slotOf(inventory, "10:2", "fill-color", 1).sourceMatch.paintShape,
        {
          consumerCount: 2,
          sourceCount: 1,
          consumerPaintTypes: ["SOLID", "SOLID"],
          sourcePaintTypes: ["SOLID"],
        },
      );
    },
  );
  await t.test("專案變數 alias 到底座品牌 → BASE_BRAND_VIA_ALIAS", async () => {
    const scenario = await createScenario();
    const { privateColor } = scenario.consumer;
    const modeId = Object.keys(privateColor.valuesByMode)[0];
    privateColor.valuesByMode[modeId] = {
      type: "VARIABLE_ALIAS",
      id: scenario.base.color.main.id,
    };
    const { plan } = await scenario.sync("u3", { planOnly: true });
    assert.deepEqual(codes(plan), ["BASE_BRAND_VIA_ALIAS"]);
  });
  await t.test(
    "gradient 綁受管變數 → UNSUPPORTED_BINDING,不轉固定色",
    async () => {
      const scenario = await createScenario();
      scenario.consumer.nodes.image.fills = [
        {
          type: "GRADIENT_LINEAR",
          gradientStops: [
            {
              position: 0,
              color: { r: 0, g: 0, b: 0, a: 1 },
              boundVariables: {
                color: {
                  type: "VARIABLE_ALIAS",
                  id: scenario.base.color.main.id,
                },
              },
            },
          ],
        },
      ];
      const { plan, inventory } = await scenario.sync("u4", { planOnly: true });
      assert.deepEqual(codes(plan), ["UNSUPPORTED_BINDING"]);
      assert.equal(inventory.coverage.unsupportedNodes, 1);
    },
  );
  await t.test(
    "品牌庫現值不等於程式推導 → BRAND_LIBRARY_MISMATCH",
    async () => {
      const scenario = await createScenario();
      const { input } = await scenario.sync("u5", { planOnly: true });
      const request = {
        ...input.request,
        brandProjection: createFigmaBrandProjection(
          brandFixture("Acme", "#086B38"),
        ),
      };
      const { core } = await import("./test-support.mjs");
      const plan = core.planSync({ ...input, request });
      assert.equal(plan.status, "blocked");
      assert.deepEqual(Array.from(new Set(codes(plan))), [
        "BRAND_LIBRARY_MISMATCH",
      ]);
      // 兩個品牌的 contrast 同為白字,其餘角色與陰影都不相等
      assert.ok(
        plan.conflicts.some((conflict) => conflict.observed.role === "main"),
      );
      assert.ok(
        plan.conflicts.some(
          (conflict) => conflict.observed.role === "primary-shadow",
        ),
      );
    },
  );
});

test("未持有 receipt 的專案 key:不自動收管,只有 fresh adopt-source resolution 能建立 ownership", async () => {
  const scenario = await createScenario();
  await scenario.sync("o1");
  // 模擬尚無 receipt 的既有補套結果(例如先前的隔離腳本):不帶 previousReceipt 重新規劃
  const unowned = await scenario.sync("o2", { planOnly: true });
  assert.equal(unowned.plan.status, "noop");
  assert.deepEqual(unowned.plan.managedSlots, []);
  const reasons = unowned.plan.preserved.map((item) => item.reason);
  assert.equal(
    reasons.filter((reason) => reason === "project-brand-binding-unowned")
      .length,
    15,
  );
  // 來源對照吻合、key 是已審的專案 key 都不足以證明是工具寫的:逐筆明示採來源才收管
  const inventory = unowned.inventory;
  const slot = slotOf(inventory, "10:2");
  const adopted = await scenario.sync("o3", {
    inventory,
    identityReview: scenario.review(inventory, [
      resolutionFor(inventory, slot, "adopt-source", "main"),
    ]),
  });
  assert.equal(adopted.plan.status, "noop");
  assert.deepEqual(
    adopted.plan.managedSlots.map((item) => item.locator.nodeId),
    ["10:2"],
  );
  assert.equal(adopted.verdict.status, "verified");
  assert.equal(adopted.verdict.receipt.managedSlots[0].firstManagedRunId, "o3");
  // 角色與來源不符的 adopt 不成立
  const wrong = await scenario.sync("o4", {
    inventory,
    identityReview: scenario.review(inventory, [
      resolutionFor(inventory, slot, "adopt-source", "dark"),
    ]),
    planOnly: true,
  });
  assert.deepEqual(codes(wrong.plan), ["RESOLUTION_ROLE_UNCONFIRMED"]);
});

test("library-upgrade:證據必須涵蓋本次 file、資產與 scope,部分接受不冒稱同步", async () => {
  const scenario = await createScenario();
  const run = (runId, options) =>
    scenario.sync(runId, {
      roots: ["10:2"],
      verificationTarget: "library-upgrade",
      planOnly: true,
      ...options,
    });
  const missing = await run("e1", {});
  assert.deepEqual(codes(missing.plan), ["EVIDENCE_REQUIRED"]);

  const partial = await run(
    "e2",
    evidence(scenario, {
      acceptance: { acceptedAssetKeys: [], scope: "partial" },
    }),
  );
  assert.deepEqual(codes(partial.plan), ["PARTIAL_ACCEPTANCE"]);
  assert.deepEqual(partial.plan.conflicts[0].observed, [
    scenario.base.components.button.key,
  ]);

  const otherFile = await run(
    "e3",
    evidence(scenario, { acceptance: { consumerFileKey: "OTHERfile01" } }),
  );
  assert.deepEqual(codes(otherFile.plan), ["EVIDENCE_FILE_MISMATCH"]);

  const otherScope = await run(
    "e4",
    evidence(scenario, { acceptance: { rootNodeIds: ["10:5"] } }),
  );
  assert.deepEqual(codes(otherScope.plan), ["EVIDENCE_SCOPE_MISMATCH"]);

  const ready = await run("e5", evidence(scenario));
  assert.equal(ready.plan.status, "ready");
  assert.equal(ready.plan.verification.target, "library-upgrade");
  assert.equal(
    ready.plan.verification.publicationEvidence.versionId,
    "2406190621933543234",
  );

  // 範圍含沒有來源對照的 direct binding 時,library-upgrade 不能成立
  const direct = await scenario.sync("e6", {
    verificationTarget: "library-upgrade",
    planOnly: true,
    ...evidence(scenario, { acceptance: { rootNodeIds: ["10:1"] } }),
  });
  assert.deepEqual(codes(direct.plan), ["SOURCE_MATCH_UNSUPPORTED"]);
});
