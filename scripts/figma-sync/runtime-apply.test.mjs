import assert from "node:assert/strict";
import { test } from "node:test";

import { createRuntime } from "./runtime.mjs";
import {
  BRAND_FILE,
  CONSUMER_FILE,
  ROLES,
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

/** 規劃完成、尚未執行;回傳執行函式與情境。 */
async function planned(runId = "ap-1", options = {}) {
  const scenario = await createScenario();
  if (options.prepare) await options.prepare(scenario);
  const result = await scenario.sync(runId, { planOnly: true });
  const request = {
    ...result.input.request,
    inputDigests: {
      ...result.input.request.inputDigests,
      plan: contract.digest(result.plan),
    },
  };
  scenario.world.resetLog();
  const execute = (plan = result.plan, applyRequest = request) =>
    createRuntime(createFakeFigma(scenario.world, CONSUMER_FILE)).applyPlan(
      applyRequest,
      plan,
    );
  return { scenario, plan: result.plan, request, execute };
}
const errorCodes = (attempt) => attempt.errors.map((error) => error.code);
const variableIdOf = (paint) => paint.boundVariables.color.id;

test("只換指定 paint 的 color 綁定:其他 paint 欄位、圖片、文字與 scope 外節點原樣", async () => {
  const { scenario, plan, execute } = await planned();
  const { nodes, control } = scenario.consumer;
  const before = {
    image: structuredClone(nodes.image.fills),
    custom: structuredClone(nodes.customButton.fills),
    private: structuredClone(nodes.privateButton.fills),
    error: structuredClone(nodes.errorButton.fills),
    outside: structuredClone(control.children[0].fills),
  };
  const attempt = await execute();
  assert.equal(attempt.status, "applied");
  assert.deepEqual(errorCodes(attempt), []);
  const project = (role) =>
    Array.from(scenario.world.variables.values()).find(
      (variable) =>
        variable.fileKey === BRAND_FILE &&
        variable.name === `primary/${role}` &&
        scenario.world.collections.get(variable.variableCollectionId).name ===
          "Color",
    );
  // 圖片節點:IMAGE paint 不動;第二個 fill 只換綁定,opacity 0.5 等欄位保留
  assert.deepEqual(nodes.image.fills[0], before.image[0]);
  assert.equal(variableIdOf(nodes.image.fills[1]), project("main").id);
  assert.deepEqual(
    { ...nodes.image.fills[1], boundVariables: null },
    { ...before.image[1], boundVariables: null },
  );
  assert.equal(variableIdOf(nodes.button.fills[0]), project("main").id);
  assert.equal(variableIdOf(nodes.button.strokes[0]), project("dark").id);
  assert.equal(
    variableIdOf(nodes.button.children[0].fills[0]),
    project("contrast").id,
  );
  // 隱藏槽也補套;客製、私有變數、error 語意與 scope 外節點完全不動
  assert.equal(
    variableIdOf(nodes.sideNav.children[2].fills[0]),
    project("light").id,
  );
  assert.deepEqual(nodes.customButton.fills, before.custom);
  assert.deepEqual(nodes.privateButton.fills, before.private);
  assert.deepEqual(nodes.errorButton.fills, before.error);
  assert.deepEqual(control.children[0].fills, before.outside);
  assert.equal(nodes.customButton.children[0].characters, "自訂文字");
  // 每筆 action 一次場景寫入;import 只取實際要寫的 key,各一次
  assert.equal(scenario.world.count("scene"), plan.actions.length);
  assert.equal(scenario.world.count("import"), 6);
  const writes = scenario.world.mutations.filter(
    (entry) => entry.type === "scene",
  );
  const touched = (nodeId, prop) =>
    writes.some(
      (entry) => entry.nodeId === nodeId && (!prop || entry.prop === prop),
    );
  assert.ok(!touched("20:2") && !touched("10:8"));
  // 私有變數那顆按鈕:fill 不寫,但它的 stroke 仍是底座品牌、照樣補套
  assert.ok(!touched("10:4", "fills") && touched("10:4", "strokes"));
});

test("品牌陰影:換成專案的 Shadow/Primary style;非品牌陰影保留", async () => {
  const { scenario, execute } = await planned();
  const { nodes } = scenario.consumer;
  const cardShadow = nodes.errorButton.effectStyleId;
  const attempt = await execute();
  const style = scenario.world.styles.get(nodes.button.effectStyleId);
  assert.equal(style.fileKey, BRAND_FILE);
  assert.equal(style.name, "Shadow/Primary");
  assert.equal(nodes.errorButton.effectStyleId, cardShadow);
  const done = attempt.completedActions.find((item) =>
    item.actionId.includes("|10:2|effect-style|"),
  );
  assert.deepEqual(done.readBack, {
    value: { kind: "style", key: style.key, localId: style.id, remote: true },
    importedAssetKey: style.key,
  });
  const slot = attempt.afterInventory.slots.find(
    (item) =>
      item.locator.nodeId === "10:2" && item.locator.field === "effect-style",
  );
  assert.equal(slot.resolvedValue.effects[0].color.a, 0.24);
});

test("先驗不符(STALE_PLAN):零 import、零場景寫入", async () => {
  for (const tamper of [
    (scenario) => (scenario.consumer.nodes.button.fills = [fixed()]),
    (scenario) =>
      (scenario.consumer.nodes.button.children[0].characters = "改了"),
    (scenario) => (scenario.consumer.nodes.button.visible = false),
    (scenario) =>
      (scenario.consumer.root.children =
        scenario.consumer.root.children.slice(1)),
  ]) {
    const { scenario, execute } = await planned();
    tamper(scenario);
    scenario.world.resetLog();
    const attempt = await execute();
    assert.equal(attempt.status, "failed");
    assert.deepEqual(errorCodes(attempt), ["STALE_PLAN"]);
    assert.deepEqual(attempt.completedActions, []);
    assert.equal(scenario.world.mutations.length, 0);
    // 失敗仍附上可取得的實際狀態
    assert.equal(attempt.afterInventory.kind, "inventory");
  }
});

test("要寫的節點不在 roots 之內:拒絕執行", async () => {
  const { scenario, plan, request, execute } = await planned();
  const outside = structuredClone(plan);
  const action = outside.actions[0];
  action.locator.nodeId = "20:2";
  action.locator.rootInstanceId = "20:2";
  const tampered = {
    ...request,
    inputDigests: { ...request.inputDigests, plan: contract.digest(outside) },
  };
  const attempt = await execute(outside, tampered);
  assert.equal(attempt.status, "failed");
  assert.equal(scenario.world.count("scene"), 0);
  assert.ok(["STALE_PLAN", "OUT_OF_SCOPE"].includes(errorCodes(attempt)[0]));
});

test("寫入中途失敗:attempt=interrupted、如實列已完成筆數,不 rollback 也不自報成功", async () => {
  const { scenario, plan, execute } = await planned();
  scenario.world.failAfter = { scene: 4 };
  const attempt = await execute();
  assert.equal(attempt.status, "interrupted");
  assert.deepEqual(errorCodes(attempt), ["WRITE_FAILED"]);
  assert.equal(attempt.errors[0].detail, plan.actions[4].actionId);
  assert.deepEqual(
    attempt.completedActions.map((item) => item.actionId),
    plan.actions.slice(0, 4).map((action) => action.actionId),
  );
  assert.equal(scenario.world.count("scene"), 4);
  const applied = attempt.afterInventory.slots.filter((slot) =>
    plan.actions.some(
      (action) =>
        contract.slotKey(action.locator) === contract.slotKey(slot.locator) &&
        slot.value.key === action.expectedAfter.key,
    ),
  );
  assert.equal(applied.length, 4);
  const verdict = core.verifySync({
    plan,
    beforeInventory: await (async () => {
      const again = await planned();
      return (await again.scenario.sync("ap-1", { planOnly: true })).inventory;
    })(),
    afterInventory: attempt.afterInventory,
    previousReceipt: null,
    attempt,
  });
  assert.equal(verdict.status, "failed");
  assert.equal(verdict.receipt, null);
});

test("回應遺失後以同一 plan 重送:逐筆判定為 already-applied,不重複寫入", async () => {
  const { scenario, plan, execute } = await planned();
  const first = await execute();
  assert.equal(first.status, "applied");
  scenario.world.resetLog();
  const again = await execute();
  assert.equal(again.status, "applied");
  assert.equal(scenario.world.mutations.length, 0);
  assert.deepEqual(
    again.completedActions.map((item) => item.result),
    Array(plan.actions.length).fill("already-applied"),
  );
});

test("缺字型或資產未發布:寫入前失敗,不代換、不留半套", async () => {
  const missingFont = await planned();
  missingFont.scenario.world.missingFonts.add("Public Sans");
  const fontAttempt = await missingFont.execute();
  assert.equal(fontAttempt.status, "failed");
  assert.deepEqual(errorCodes(fontAttempt), ["FONT_MISSING"]);
  assert.equal(missingFont.scenario.world.mutations.length, 0);

  const unpublished = await planned();
  for (const variable of unpublished.scenario.world.variables.values()) {
    if (variable.fileKey === BRAND_FILE && variable.name === "primary/dark") {
      variable.unpublished = true;
    }
  }
  const importAttempt = await unpublished.execute();
  assert.equal(importAttempt.status, "failed");
  assert.deepEqual(errorCodes(importAttempt), ["IMPORT_FAILED"]);
  assert.equal(unpublished.scenario.world.count("scene"), 0);
});

// ── 品牌庫 ──────────────────────────────────────────────────────────────────

test("空品牌庫初建:兩個只有 Light 的集合、12 個變數、六個 alias、一個 style,再跑零 action", async () => {
  const world = createWorld();
  world.addFile(BRAND_FILE, ["Brand"]);
  const first = await planBrandRun(world, { runId: "ab-1" });
  assert.equal(first.attempt.status, "applied");
  const own = (store) =>
    Array.from(world[store].values()).filter(
      (item) => item.fileKey === BRAND_FILE,
    );
  const [brand, color] = ["Brand", "Color"].map((name) =>
    own("collections").find((collection) => collection.name === name),
  );
  for (const collection of [brand, color]) {
    assert.deepEqual(
      collection.modes.map((mode) => mode.name),
      ["Light"],
    );
  }
  const variables = own("variables");
  assert.equal(variables.length, 12);
  const projection = first.plan.verification.expectedRoleValues;
  for (const role of ROLES) {
    const find = (collection) =>
      variables.find(
        (variable) =>
          variable.variableCollectionId === collection.id &&
          variable.name === `primary/${role}`,
      );
    assert.deepEqual(
      find(brand).valuesByMode[brand.defaultModeId],
      projection[role],
    );
    // Color 的值是指向同角色 Brand 變數的 alias,mode ID 用 Color 自己的
    assert.deepEqual(find(color).valuesByMode[color.defaultModeId], {
      type: "VARIABLE_ALIAS",
      id: find(brand).id,
    });
  }
  assert.equal(own("styles").length, 1);
  assert.equal(own("styles")[0].name, "Shadow/Primary");
  assert.match(own("styles")[0].id, /^S:[0-9a-f]{40},$/);
  const createdStyle = first.attempt.completedActions.find(
    (item) => item.readBack.kind === "effect-style",
  );
  assert.equal(createdStyle.readBack.localId, own("styles")[0].id);
  assert.deepEqual(own("styles")[0].effects, [
    first.plan.verification.expectedPrimaryEffect,
  ]);
  // create 的 readBack 是真 key / localId;集合另帶實際 defaultModeId
  const created = first.attempt.completedActions.find(
    (item) => item.actionId === "create-collection:Brand",
  );
  assert.deepEqual(created.readBack, {
    kind: "collection",
    key: brand.key,
    localId: brand.id,
    defaultModeId: brand.defaultModeId,
  });
  assert.equal(first.attempt.afterInventory.assets.length, 15);
  assert.equal(first.verdict.receipt.verification.exactColors, 12);
  assert.equal(first.verdict.receipt.verification.exactPrimaryEffects, 1);

  world.resetLog();
  const second = await planBrandRun(world, {
    runId: "ab-2",
    previousReceipt: first.verdict.receipt,
  });
  assert.equal(second.plan.actions.length, 0);
  assert.equal(world.mutations.length, 0);
  assert.equal(second.verdict.status, "verified");
});

test("create 之後讀不到真 key:立刻停,不按名稱尋找、不再建,也沒有成功狀態", async () => {
  const world = createWorld();
  world.addFile(BRAND_FILE, ["Brand"]);
  world.createWithoutKey = "variable";
  const { attempt, verdict } = await planBrandRun(world, { runId: "ab-3" });
  assert.equal(attempt.status, "interrupted");
  assert.equal(attempt.errors[0].code, "CREATED_ASSET_IDENTITY_UNRESOLVED");
  assert.equal(attempt.errors[0].detail, "create-variable:Brand:lighter");
  // 兩個集合已建立並留有 readBack;第一個變數之後不再有任何 create
  assert.deepEqual(
    attempt.completedActions.map((item) => item.actionId),
    ["create-collection:Brand", "create-collection:Color"],
  );
  assert.equal(world.count("asset"), 3);
  assert.equal(verdict, null);
});

test("既有 key 的更新:寫前再驗 before,不符即停", async () => {
  const world = createWorld();
  world.addFile(BRAND_FILE, ["Brand"]);
  const first = await planBrandRun(world, { runId: "ab-4" });
  const brand = await scan(
    world,
    "brand-library",
    BRAND_FILE,
    [`P${BRAND_FILE}:0`],
    "ab-5-scan",
  );
  const { createFigmaBrandProjection } = await import("./brand.mjs");
  const { brandFixture } = await import("./test-support.mjs");
  const base = makeRequest({
    operation: "apply",
    targetKind: "brand-library",
    fileKey: BRAND_FILE,
    roots: brand.scope.rootNodeIds,
    runId: "ab-5",
    projection: createFigmaBrandProjection(brandFixture("Acme", "#086B38")),
    inputDigests: {
      inventories: [contract.digest(brand)],
      previousReceipt: contract.digest(first.verdict.receipt),
    },
  });
  const plan = core.planSync({
    request: base,
    inventories: { brand },
    previousReceipt: first.verdict.receipt,
  });
  // 規劃後有人手動改了 Brand/main
  const main = Array.from(world.variables.values()).find(
    (variable) =>
      variable.fileKey === BRAND_FILE &&
      variable.name === "primary/main" &&
      world.collections.get(variable.variableCollectionId).name === "Brand",
  );
  main.valuesByMode[Object.keys(main.valuesByMode)[0]] = {
    r: 0,
    g: 0,
    b: 0,
    a: 1,
  };
  world.resetLog();
  const attempt = await createRuntime(
    createFakeFigma(world, BRAND_FILE),
  ).applyPlan(
    {
      ...base,
      inputDigests: { ...base.inputDigests, plan: contract.digest(plan) },
    },
    plan,
  );
  assert.equal(attempt.status, "failed");
  assert.deepEqual(errorCodes(attempt), ["STALE_PLAN"]);
  assert.equal(world.mutations.length, 0);
});

test("全域先驗:非 action 的節點、控制值、新問題或品牌資產值變了,都在零場景寫入時 STALE_PLAN", async () => {
  const brandMain = (scenario) =>
    Array.from(scenario.world.variables.values()).find(
      (variable) =>
        variable.fileKey === BRAND_FILE &&
        variable.name === "primary/main" &&
        scenario.world.collections.get(variable.variableCollectionId).name ===
          "Brand",
    );
  for (const [label, tamper] of [
    // 都不是任何 action 的節點或欄位
    [
      "私人文字",
      (s) => (s.consumer.nodes.errorButton.children[0].characters = "改"),
    ],
    [
      "無 slot 節點的 visible",
      (s) => (s.consumer.nodes.sideNav.children[3].visible = false),
    ],
    ["container 幾何", (s) => (s.consumer.root.height = 999)],
    [
      "非 action slot 的值",
      (s) => (s.consumer.nodes.privateButton.fills = [fixed()]),
    ],
    ["scope 外控制值", (s) => (s.consumer.control.children[0].visible = false)],
    [
      "新出現的 alias 問題",
      (s) => {
        const variable = s.consumer.privateColor;
        variable.valuesByMode[Object.keys(variable.valuesByMode)[0]] = {
          type: "VARIABLE_ALIAS",
          id: variable.id,
        };
      },
    ],
    [
      "要寫入的品牌變數值",
      (s) => {
        const variable = brandMain(s);
        variable.valuesByMode[Object.keys(variable.valuesByMode)[0]] = {
          r: 0,
          g: 0,
          b: 0,
          a: 1,
        };
      },
    ],
  ]) {
    const { scenario, execute } = await planned();
    tamper(scenario);
    scenario.world.resetLog();
    const attempt = await execute();
    assert.equal(attempt.status, "failed", label);
    assert.deepEqual(errorCodes(attempt), ["STALE_PLAN"], label);
    assert.deepEqual(attempt.completedActions, [], label);
    assert.equal(scenario.world.count("scene"), 0, label);
  }
});

test("noop plan 也要通過完整先驗,不因零 action 就直接回 applied", async () => {
  const scenario = await createScenario();
  const first = await scenario.sync("np-1");
  const noop = await scenario.sync("np-2", {
    previousReceipt: first.verdict.receipt,
    planOnly: true,
  });
  assert.equal(noop.plan.status, "noop");
  const request = {
    ...noop.input.request,
    inputDigests: {
      ...noop.input.request.inputDigests,
      plan: contract.digest(noop.plan),
    },
  };
  const run = () =>
    createRuntime(createFakeFigma(scenario.world, CONSUMER_FILE)).applyPlan(
      request,
      noop.plan,
    );
  assert.equal((await run()).status, "applied");
  scenario.consumer.nodes.customButton.children[0].characters = "規劃後改的";
  const stale = await run();
  assert.equal(stale.status, "failed");
  assert.deepEqual(errorCodes(stale), ["STALE_PLAN"]);
  // 受管 slot 被改掉也一樣
  scenario.consumer.nodes.customButton.children[0].characters = "自訂文字";
  scenario.consumer.nodes.button.fills = [fixed()];
  assert.deepEqual(errorCodes(await run()), ["STALE_PLAN"]);
});

test("逐筆寫前再驗:apply 進行中後面的節點被改動,該筆不寫並如實停在 interrupted", async () => {
  const { scenario, plan, execute } = await planned();
  const victim = scenario.consumer.nodes.sideNav.children[1];
  scenario.world.afterWrite = (entry) => {
    // 第一筆場景寫入完成後,有人把另一個待寫節點藏起來(protected 欄位變了)
    if (entry.type === "scene" && scenario.world.writes.scene === 1) {
      victim.visible = false;
    }
  };
  const attempt = await execute();
  scenario.world.afterWrite = null;
  assert.equal(attempt.status, "interrupted");
  assert.deepEqual(errorCodes(attempt), ["STALE_PLAN"]);
  const stopped = plan.actions.findIndex(
    (action) => action.locator.nodeId === victim.id,
  );
  assert.ok(stopped > 0);
  assert.equal(attempt.errors[0].detail, plan.actions[stopped].actionId);
  assert.equal(attempt.completedActions.length, stopped);
  assert.equal(scenario.world.count("scene"), stopped);
  assert.ok(
    !scenario.world.mutations.some((entry) => entry.nodeId === victim.id),
  );
});

test("新建身分超出支援範圍(過長或含不支援字元):視為身分未解,不再建", async () => {
  for (const key of ["k".repeat(65), "has space", "含中文"]) {
    const world = createWorld();
    world.addFile(BRAND_FILE, ["Brand"]);
    world.createdKey = key;
    const { attempt, verdict } = await planBrandRun(world, { runId: "id-1" });
    assert.equal(attempt.status, "interrupted");
    assert.equal(attempt.errors[0].code, "CREATED_ASSET_IDENTITY_UNRESOLVED");
    assert.equal(attempt.errors[0].detail, "create-collection:Brand");
    assert.deepEqual(attempt.completedActions, []);
    assert.equal(world.count("asset"), 1);
    assert.equal(verdict.status, "failed");
    assert.equal(verdict.receipt, null);
  }
});

test("style localId 的尾逗號保留原值,仍拒絕超長或需 JSON escaping 的身分", async () => {
  const world = createWorld();
  world.addFile(BRAND_FILE, ["Brand"]);
  world.createdStyleId = `S:${"a".repeat(125)},`;
  assert.equal(world.createdStyleId.length, 128);
  const valid = await planBrandRun(world, { runId: "style-id-limit" });
  assert.equal(valid.attempt.status, "applied");
  assert.equal(valid.attempt.completedActions.length, 28);
  assert.equal(
    valid.verdict.receipt.managedAssets.find(
      (asset) => asset.kind === "effect-style",
    ).localId,
    world.createdStyleId,
  );

  for (const localId of [
    `S:${"a".repeat(126)},`,
    'S:unsafe"id,',
    "S:unsafe\\id,",
    "S:unsafe\nid,",
    "S:含中文,",
  ]) {
    const invalid = createWorld();
    invalid.addFile(BRAND_FILE, ["Brand"]);
    invalid.createdStyleId = localId;
    const { attempt, verdict } = await planBrandRun(invalid, {
      runId: "style-id-invalid",
    });
    assert.equal(attempt.status, "interrupted");
    assert.equal(attempt.errors[0].code, "CREATED_ASSET_IDENTITY_UNRESOLVED");
    assert.equal(attempt.completedActions.length, 26);
    assert.equal(invalid.styles.size, 1);
    assert.equal(
      invalid.mutations.filter((entry) => entry.op === "set-effects").length,
      0,
    );
    assert.equal(verdict.status, "failed");
    assert.equal(verdict.receipt, null);
  }
});
