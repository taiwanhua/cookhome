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

test("review:exact file / key / type / role 才接受", () => {
  const { base, brand } = scenario.inventories;
  const attempt = (change, extra = {}) => {
    const selections = selectionsFor(base, brand);
    change(selections);
    return () => scenario.review(extra.consumer ?? null, [], { selections });
  };
  assert.equal(scenario.review().selections.length, 13);
  assert.throws(
    attempt((list) => (list[2].source.fileKey = BRAND_FILE)),
    code("SELECTION_NOT_EXACT"),
  );
  assert.throws(
    attempt((list) => (list[2].project.key = "vk-not-there")),
    code("SELECTION_NOT_EXACT"),
  );
  assert.throws(
    attempt((list) => {
      list[2].source.resolvedType = "FLOAT";
      list[2].project.resolvedType = "FLOAT";
    }),
    code("SELECTION_NOT_EXACT"),
  );
  assert.throws(
    attempt((list) => (list[2].project.resolvedType = "FLOAT")),
    code("SELECTION_TYPE_MISMATCH"),
  );
  assert.throws(
    attempt((list) => (list[12].assetKind = "variable")),
    code("SELECTION_KIND_MISMATCH"),
  );
  assert.throws(
    attempt((list) => list.push(clone(list[0]))),
    code("SELECTION_DUPLICATE_SOURCE"),
  );
  // 同一把 project key 不能同時是兩個角色
  assert.throws(
    attempt((list) => (list[1].project = clone(list[0].project))),
    code("SELECTION_ROLE_CONFLICT"),
  );
  // Color/main 的 alias 終點是 Brand/main:把它選成別的角色就與終點不一致
  assert.throws(
    attempt((list) => {
      list[8].role = "dark";
      list.splice(9, 1);
    }),
    code("SELECTION_ALIAS_ROLE_MISMATCH"),
  );
  assert.throws(
    () => scenario.review(null, [], { selections: [] }),
    code("SELECTIONS_EMPTY"),
  );
});

test("review:同名異 key 的重建資產不會被名稱帶入", async () => {
  // 底座刪掉 Color/primary/main 後以同名重建:新 key 沒被選擇,舊選擇也不再 exact
  const rebuilt = await createScenario();
  const old = rebuilt.base.color.main;
  rebuilt.world.variables.delete(old.id);
  const collection = rebuilt.world.collections.get(old.variableCollectionId);
  const recreated = rebuilt.world.addVariable(BASE_FILE, old.name, collection, {
    ...old.valuesByMode,
  });
  const { scan } = await import("./test-support.mjs");
  const base = await scan(
    rebuilt.world,
    "base-library",
    BASE_FILE,
    [rebuilt.base.page.id],
    "scan-base-2",
  );
  const stale = selectionsFor(
    rebuilt.inventories.base,
    rebuilt.inventories.brand,
  );
  const input = {
    ...makeHeader("review-rebuilt"),
    inventories: { base, brand: rebuilt.inventories.brand, consumer: null },
    resolutions: [],
    reviewEvidenceURL: "https://github.com/acme/widgets/issues/1",
  };
  assert.throws(
    () => core.createIdentityReview({ ...input, selections: stale }),
    code("SELECTION_NOT_EXACT"),
  );
  const fresh = selectionsFor(base, rebuilt.inventories.brand);
  assert.equal(fresh[8].source.key, recreated.key);
  assert.notEqual(fresh[8].source.key, old.key);
  assert.equal(
    core.createIdentityReview({ ...input, selections: fresh }).selections
      .length,
    13,
  );
});

test("resolutions:綁定本次 consumer inventory、實際 before 與來源對照 digest", () => {
  const slot = consumerInventory.slots.find(
    (item) =>
      item.locator.nodeId === "10:2" && item.locator.field === "fill-color",
  );
  const resolution = {
    locator: slot.locator,
    consumerInventoryDigest: contract.digest(consumerInventory),
    before: slot.value,
    sourceMatchDigest: contract.digest(slot.sourceMatch),
    decision: "preserve-project",
    expectedRole: null,
  };
  assert.equal(
    scenario.review(consumerInventory, [resolution]).resolutions.length,
    1,
  );
  const stale = code("RESOLUTION_STALE");
  for (const change of [
    { consumerInventoryDigest: contract.digest("other") },
    { before: { kind: "fixed", rgba: { r: 0, g: 0, b: 0, a: 1 } } },
    { sourceMatchDigest: contract.digest("other") },
  ]) {
    assert.throws(
      () => scenario.review(consumerInventory, [{ ...resolution, ...change }]),
      stale,
    );
  }
  assert.throws(
    () => scenario.review(null, [resolution]),
    code("RESOLUTION_NEEDS_CONSUMER"),
  );
  assert.throws(
    () =>
      scenario.review(consumerInventory, [
        { ...resolution, expectedRole: "main" },
      ]),
    code("RESOLUTION_ROLE_INVALID"),
  );
  assert.throws(
    () => scenario.review(consumerInventory, [resolution, resolution]),
    code("RESOLUTION_DUPLICATE"),
  );
});
