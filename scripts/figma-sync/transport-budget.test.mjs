import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BRAND_FILE,
  contract,
  createScenario,
  createWorld,
  planBrandRun,
} from "./test-support.mjs";
import { createTraceBudget } from "./transport-budget.mjs";

const budget = createTraceBudget(contract);
const headBytes = (attempt) => {
  const head = { ...attempt };
  delete head.afterInventory;
  return Buffer.byteLength(JSON.stringify(head), "utf8");
};

test("空品牌庫的 28 筆 action 放得進 10,240 bytes 的 attemptHead 預算", async () => {
  const world = createWorld();
  world.addFile(BRAND_FILE, ["Brand"]);
  const run = await planBrandRun(world, { runId: "budget-brand" });
  assert.equal(run.plan.actions.length, 28);
  const result = budget.traceBudget(run.applyRequest, run.plan);
  assert.equal(budget.ATTEMPT_HEAD_BYTES, 10240);
  assert.equal(result.ok, true, String(result.bytes));
  // 保守上界:實際 attemptHead 一定不超過預估
  assert.ok(headBytes(run.attempt) <= result.bytes);
});

test("上界以各欄位最大值計:新建身分 key 64、localId 128、defaultModeId 64 bytes", async () => {
  const world = createWorld();
  world.addFile(BRAND_FILE, ["Brand"]);
  const run = await planBrandRun(world, { runId: "budget-max" });
  // 把實際 readBack 的身分全部撐到支援上限,仍在預估之內
  const stretched = structuredClone(run.attempt);
  for (const done of stretched.completedActions) {
    const readBack = done.readBack;
    if (readBack.key !== undefined) {
      readBack.kind = "effect-style";
      readBack.key = "k".repeat(64);
      readBack.localId = "l".repeat(128);
      if (readBack.defaultModeId) readBack.defaultModeId = "m".repeat(64);
    } else if (readBack.value.kind === "alias") {
      readBack.value.variableKey = "k".repeat(64);
    }
    done.result = "already-applied";
  }
  stretched.status = "interrupted";
  stretched.errors = [
    {
      code: "CREATED_ASSET_IDENTITY_UNRESOLVED",
      detail: "create-variable:Brand:contrast",
    },
  ];
  const result = budget.traceBudget(run.applyRequest, run.plan);
  assert.ok(
    headBytes(stretched) <= result.bytes,
    `${headBytes(stretched)} > ${result.bytes}`,
  );
});

test("consumer plan:一般筆數可執行;過多筆數在任何 mutation 前就判定超量", async () => {
  const scenario = await createScenario();
  const run = await scenario.sync("budget-consumer");
  const fits = budget.traceBudget(run.applyRequest, run.plan);
  assert.equal(fits.ok, true);
  assert.ok(headBytes(run.attempt) <= fits.bytes);
  // 同一份 plan 的 action 複製到 60 筆:超過預算
  const many = structuredClone(run.plan);
  while (many.actions.length < 60) {
    const copy = structuredClone(run.plan.actions[many.actions.length % 15]);
    copy.actionId = `${copy.actionId}#${many.actions.length}`;
    many.actions.push(copy);
  }
  const exceeds = budget.traceBudget(run.applyRequest, many);
  assert.equal(exceeds.ok, false);
  assert.ok(exceeds.bytes > 10240);
  // 筆數越多,上界越大
  assert.ok(exceeds.bytes > fits.bytes);
});
