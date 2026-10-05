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

test("品牌初建 plan 的相依圖:順序、種類、集合與角色都驗", async () => {
  const world = createWorld();
  world.addFile(BRAND_FILE, ["Brand"]);
  const { plan } = await planBrandRun(world, { runId: "graph-1" });
  assert.equal(contract.validateArtifact(plan), plan);
  const broken = (change, expected) => {
    const copy = clone(plan);
    change(copy.actions, copy);
    assert.throws(() => contract.validateArtifact(copy), code(expected));
  };
  const find = (actions, id) =>
    actions.find((action) => action.actionId === id);
  // forward reference:變數排到它的集合之前
  broken((actions) => {
    const index = actions.findIndex(
      (action) => action.actionId === "create-variable:Brand:main",
    );
    actions.unshift(actions.splice(index, 1)[0]);
  }, "PLAN_REF_FORWARD");
  broken(
    (actions) =>
      (find(
        actions,
        "create-variable:Brand:main",
      ).params.collectionRef.actionId = "create-variable:Brand:light"),
    "PLAN_REF_FORWARD",
  );
  // kind 不符:alias target 指到 collection
  broken(
    (actions) =>
      (find(actions, "set-variable-value:Color:main").params.value.targetRef = {
        kind: "collection",
        actionId: "create-collection:Brand",
      }),
    "PLAN_REF_INVALID",
  );
  broken(
    (actions) =>
      (find(actions, "create-variable:Brand:main").params.collectionRef = {
        kind: "collection",
        actionId: "create-effect-style",
      }),
    "PLAN_REF_FORWARD",
  );
  // 集合不符:Brand 變數掛到 Color 集合
  broken(
    (actions) =>
      (find(
        actions,
        "create-variable:Brand:main",
      ).params.collectionRef.actionId = "create-collection:Color"),
    "PLAN_REF_ROLE",
  );
  // 角色不符:Color/main 的 alias 指到 Brand/dark
  broken(
    (actions) =>
      (find(
        actions,
        "set-variable-value:Color:main",
      ).params.value.targetRef.actionId = "create-variable:Brand:dark"),
    "PLAN_REF_ROLE",
  );
  // Color 不能直接填 rgba;key 與 actionId 互斥
  broken(
    (actions) =>
      (find(actions, "set-variable-value:Color:main").params.value = {
        kind: "rgba",
        rgba: { r: 0, g: 0, b: 0, a: 1 },
      }),
    "PLAN_REF_ROLE",
  );
  broken(
    (actions) =>
      (find(actions, "set-effect-style-effects").params.styleRef.key =
        "sk0001"),
    "PLAN_REF_INVALID",
  );
  broken((actions) => actions.push(clone(actions[0])), "PLAN_ACTION_DUPLICATE");
  broken(
    (actions) => (actions[0].operation = "set-paint-variable"),
    "PLAN_OPERATION_INVALID",
  );
  broken((actions, copy) => (copy.status = "noop"), "ARTIFACT_INVALID");
});

test("場景 action:operation 與 expectedAfter 的型別由 field 決定,不沿用被取代的現值 kind", async () => {
  const run = await scenario.sync("graph-scene", { planOnly: true });
  assert.equal(contract.validateArtifact(run.plan), run.plan);
  const find = (actions, field) =>
    actions.find((action) => action.locator.field === field);
  const broken = (change) => {
    const copy = clone(run.plan);
    change(copy.actions);
    assert.throws(
      () => contract.validateArtifact(copy),
      code("PLAN_OPERATION_INVALID"),
    );
  };
  broken(
    (actions) => (find(actions, "fill-color").expectedAfter.kind = "fixed"),
  );
  broken(
    (actions) => (find(actions, "fill-color").expectedAfter.kind = "style"),
  );
  broken(
    (actions) =>
      (find(actions, "effect-style").expectedAfter.kind = "variable"),
  );
  // operation 與 field 對不上:連同 ref 一起換成 style 仍被擋下
  broken((actions) => {
    const action = find(actions, "fill-color");
    action.operation = "set-effect-style";
    action.params = {
      styleRef: { kind: "effect-style", key: action.params.variableRef.key },
    };
    action.expectedAfter.kind = "style";
  });
  // 場景 action 只能用已發布的 existing key,不能指向 create action
  const copy = clone(run.plan);
  find(copy.actions, "fill-color").params.variableRef = {
    kind: "variable",
    actionId: copy.actions[0].actionId,
  };
  assert.throws(
    () => contract.validateArtifact(copy),
    code("PLAN_REF_FORWARD"),
  );
});
