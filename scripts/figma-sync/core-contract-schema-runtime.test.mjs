import assert from "node:assert/strict";
import { test } from "node:test";

import { createSchemaRuntime } from "./core-contract-schema-runtime.mjs";
import { createSchemaDefinitions } from "./core-contract-schema.mjs";
import { contract, createScenario } from "./test-support.mjs";

test("schema definitions 自動產生純 JSON；同一引擎對還原資料仍拒絕缺欄、未知欄、非法 enum 與 locator", async () => {
  const definitions = createSchemaDefinitions(contract);
  const plain = JSON.parse(contract.canonicalJson(definitions));
  assert.deepEqual(plain, definitions);
  const runtime = createSchemaRuntime(contract, plain);
  const inventory = await (await createScenario()).scanConsumer("schema-data");
  const body = ({
    schemaVersion,
    kind,
    runId,
    generatedAt,
    project,
    tool,
    ...rest
  }) => rest;
  runtime.shape(body(inventory), runtime.bodies.inventory, "inventory");
  for (const change of [
    (value) => delete value.nodes,
    (value) => (value.extra = 1),
    (value) => (value.slots[0].sourceMatch.status = "guessed"),
    (value) => (value.slots[0].locator.field = "unknown"),
    (value) => (value.slots[0].locator.index = null),
  ]) {
    const edited = body(structuredClone(inventory));
    change(edited);
    assert.throws(
      () => runtime.shape(edited, runtime.bodies.inventory, "inventory"),
      { code: "ARTIFACT_INVALID" },
    );
  }
});

test("具名 validator 只允許固定實作；nullable 與 enum 仍沿同一 shape engine", () => {
  const runtime = createSchemaRuntime(
    contract,
    createSchemaDefinitions(contract),
  );
  assert.throws(() => runtime.shape({}, { $validator: "external" }, "bad"), {
    code: "SCHEMA_INVALID",
  });
  runtime.shape(null, runtime.nullable("string"), "nullable");
  runtime.shape("a", runtime.oneOf(["a", "b"]), "enum");
  assert.throws(
    () => runtime.shape(42, runtime.nullable("string"), "nullable"),
    { code: "ARTIFACT_INVALID" },
  );
});
