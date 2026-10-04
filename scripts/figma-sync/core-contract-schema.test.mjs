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

test("validateArtifact:未知 kind、缺欄位、錯型別、未知欄位、來源不符都拒絕", () => {
  const invalid = code("ARTIFACT_INVALID");
  const mutate = (change) => {
    const copy = clone(consumerInventory);
    change(copy);
    return () => contract.validateArtifact(copy);
  };
  assert.equal(contract.validateArtifact(consumerInventory), consumerInventory);
  assert.throws(
    mutate((copy) => (copy.kind = "snapshot")),
    invalid,
  );
  assert.throws(
    mutate((copy) => delete copy.coverage),
    invalid,
  );
  assert.throws(
    mutate((copy) => (copy.coverage.nodes = "24")),
    invalid,
  );
  assert.throws(
    mutate((copy) => (copy.extra = true)),
    invalid,
  );
  assert.throws(
    mutate((copy) => (copy.schemaVersion = 2)),
    invalid,
  );
  assert.throws(
    mutate((copy) => (copy.project.gitCommit = "HEAD")),
    invalid,
  );
  assert.throws(
    mutate((copy) => (copy.slots[0].locator.fileKey = BASE_FILE)),
    invalid,
  );
  assert.throws(
    mutate((copy) => (copy.slots[0].locator.field = "text-color")),
    invalid,
  );
  assert.throws(() => contract.validateArtifact(null), invalid);
});

test("inventory.nodes:每個 slot 的節點都要有 node 觀測;缺 nodes 或欄位不全都拒絕", () => {
  const invalid = code("ARTIFACT_INVALID");
  const mutate = (change) => {
    const copy = clone(consumerInventory);
    change(copy);
    return () => contract.validateArtifact(copy);
  };
  assert.ok(
    consumerInventory.nodes.length > consumerInventory.slots.length / 3,
  );
  assert.throws(
    mutate((copy) => delete copy.nodes),
    invalid,
  );
  assert.throws(
    mutate((copy) => (copy.nodes = [])),
    invalid,
  );
  assert.throws(
    mutate((copy) => delete copy.nodes[0].ancestorIds),
    invalid,
  );
  assert.throws(
    mutate((copy) => (copy.nodes[0].pageId = "")),
    invalid,
  );
  assert.throws(
    mutate((copy) => (copy.nodes[0].scopeRootId = 7)),
    invalid,
  );
  assert.throws(
    mutate((copy) => (copy.nodes[0].extra = 1)),
    invalid,
  );
  // 控制節點的 scopeRootId 是 null,合法
  assert.ok(consumerInventory.nodes.some((node) => node.scopeRootId === null));
  // collection 資產與遠端資產(fileKey=null)都是合法內容
  assert.ok(
    scenario.inventories.base.assets.some(
      (asset) => asset.kind === "collection",
    ),
  );
  assert.ok(consumerInventory.assets.some((asset) => asset.fileKey === null));
});
