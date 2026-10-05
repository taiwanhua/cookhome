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

test("canonical JSON:keys 依 UTF-16 code unit 排序、array 保留順序、與空白排版無關", () => {
  const value = { b: 1, a: [3, 1, { z: null, y: "中" }], "\u{1F600}": 0, é: 2 };
  assert.equal(
    contract.canonicalJson(value),
    '{"a":[3,1,{"y":"中","z":null}],"b":1,"é":2,"\u{1F600}":0}',
  );
  const reformatted = JSON.parse(JSON.stringify(value, null, 4));
  assert.equal(contract.digest(reformatted), contract.digest(value));
});

test("canonical JSON:拒絕 undefined、非有限數值與非 JSON 型別,不省略欄位", () => {
  for (const value of [
    { a: undefined },
    [Number.NaN],
    { a: Number.POSITIVE_INFINITY },
    { a: () => 1 },
    { a: 1n },
    new Map(),
  ]) {
    assert.throws(() => contract.canonicalJson(value), code("NON_JSON_VALUE"));
  }
});

test("純 JS SHA-256 與 Node 的 hashArtifact 對同一 canonical JSON 結果相同", () => {
  for (const value of [
    {},
    { text: "繁體中文與 emoji \u{1F600}\u{1F9E1}", n: [0.1, -0, 1e21] },
    { long: "x".repeat(5000) },
    consumerInventory,
  ]) {
    assert.equal(contract.digest(value), hashArtifact(value));
  }
  assert.equal(
    hashArtifact({}),
    "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
  );
});

test("alias 解析:cycle、缺 mode、深度超限、缺目標都明確失敗", () => {
  const variable = (key, value, modeId = "m") => ({
    kind: "variable",
    key,
    collectionKey: "c",
    resolvedType: "COLOR",
    valueOrEffects: { defaultModeId: "m", valuesByMode: { [modeId]: value } },
  });
  const alias = (key) => ({ kind: "alias", variableKey: key });
  const rgba = { kind: "rgba", rgba: { r: 0, g: 0, b: 0, a: 1 } };
  const index = (assets) => contract.indexAssets({ assets });
  const resolved = contract.resolveAssetChain(
    index([variable("a", alias("b")), variable("b", rgba)]),
    "a",
  );
  assert.equal(resolved.terminalKey, "b");
  assert.deepEqual(
    resolved.chain.map((step) => [step.variableKey, step.aliasTargetKey]),
    [
      ["a", "b"],
      ["b", null],
    ],
  );
  assert.throws(
    () =>
      contract.resolveAssetChain(
        index([variable("a", alias("b")), variable("b", alias("a"))]),
        "a",
      ),
    code("ALIAS_CYCLE"),
  );
  assert.throws(
    () =>
      contract.resolveAssetChain(index([variable("a", rgba, "other")]), "a"),
    code("ALIAS_MODE_MISSING"),
  );
  assert.throws(
    () =>
      contract.resolveAssetChain(index([variable("a", alias("gone"))]), "a"),
    code("ALIAS_TARGET_MISSING"),
  );
  const deep = Array.from({ length: 10 }, (_, i) =>
    variable(`v${i}`, i === 9 ? rgba : alias(`v${i + 1}`)),
  );
  assert.throws(
    () => contract.resolveAssetChain(index(deep), "v0"),
    code("ALIAS_DEPTH_EXCEEDED"),
  );
});

test("scope guards:節點、非 action slot、issues、capabilities 任何一項變了 digest 就不同", () => {
  const none = new Set();
  const base = contract.scopeGuard(consumerInventory, none, null);
  assert.equal(
    base.nodes,
    consumerInventory.nodes.filter((n) => n.scopeRootId).length,
  );
  assert.equal(
    contract.scopeGuard(clone(consumerInventory), none, null).digest,
    base.digest,
  );
  const inside = consumerInventory.nodes.findIndex(
    (node) => node.scopeRootId !== null,
  );
  const outside = consumerInventory.nodes.findIndex(
    (node) => node.scopeRootId === null,
  );
  const insideSlot = consumerInventory.slots.findIndex(
    (slot) => slot.locator.nodeId === "10:3",
  );
  for (const change of [
    (copy) => (copy.nodes[inside].protectedSnapshot.visible = false),
    (copy) => copy.nodes[inside].ancestorIds.push("x"),
    (copy) => (copy.slots[insideSlot].value.rgba.r = 0),
    (copy) => (copy.slots[insideSlot].sourceMatch.sourceNodeId = "9:9"),
    (copy) => copy.issues.push({ code: "ALIAS_CYCLE", detail: "" }),
    (copy) => (copy.capabilities.variablesReadable = false),
  ]) {
    const copy = clone(consumerInventory);
    change(copy);
    assert.notEqual(contract.scopeGuard(copy, none, null).digest, base.digest);
    assert.equal(
      contract.controlGuard(copy).digest,
      contract.controlGuard(consumerInventory).digest,
    );
  }
  // action 自己的 slot 由逐筆 before / expectedAfter 判定,不在整體 guard 內
  const key = contract.slotKey(consumerInventory.slots[insideSlot].locator);
  const copy = clone(consumerInventory);
  copy.slots[insideSlot].value.rgba.r = 0;
  assert.equal(
    contract.scopeGuard(copy, new Set([key]), null).digest,
    contract.scopeGuard(consumerInventory, new Set([key]), null).digest,
  );
  // scope 外控制值只影響 controlGuard
  const moved = clone(consumerInventory);
  moved.nodes[outside].protectedSnapshot.visible = false;
  assert.equal(contract.scopeGuard(moved, none, null).digest, base.digest);
  assert.notEqual(
    contract.controlGuard(moved).digest,
    contract.controlGuard(consumerInventory).digest,
  );
});

test("blockingIssue / scopeEvidenceOf / chainKeys / UTF-8 長度", () => {
  const identity = new Set(["k1"]);
  const managed = new Set(["F|n1|fill-color|0"]);
  const locator = { fileKey: "F", nodeId: "n1", field: "fill-color", index: 0 };
  const blocks = (issue) => contract.blockingIssue(issue, identity, managed);
  assert.equal(blocks({ code: "CAPABILITY_MISSING", detail: "" }), true);
  assert.equal(
    blocks({ code: "ALIAS_CYCLE", locator: { ...locator, nodeId: "x" } }),
    true,
  );
  assert.equal(
    blocks({
      code: "SOURCE_ALIAS_CYCLE",
      locator: { ...locator, nodeId: "x" },
    }),
    true,
  );
  assert.equal(
    blocks({
      code: "UNSUPPORTED_BINDING",
      assetKey: "k1",
      locator: { ...locator, nodeId: "x" },
    }),
    true,
  );
  assert.equal(blocks({ code: "UNSUPPORTED_BINDING", locator }), true);
  assert.equal(
    blocks({
      code: "UNSUPPORTED_BINDING",
      assetKey: "other",
      locator: { ...locator, nodeId: "x" },
    }),
    false,
  );
  assert.equal(
    blocks({ code: "BROKEN_INSTANCE", locator: { ...locator, nodeId: "x" } }),
    false,
  );
  const nodes = contract.indexNodes(consumerInventory);
  const first = consumerInventory.nodes[1];
  assert.deepEqual(contract.scopeEvidenceOf(nodes, first.nodeId), {
    pageId: first.pageId,
    scopeRootId: first.scopeRootId,
    ancestorIds: first.ancestorIds,
  });
  assert.deepEqual(
    contract.chainKeys([
      {
        variableKey: "a",
        aliasTargetKey: "b",
        modeId: "m1",
        collectionKey: "c",
      },
      {
        variableKey: "b",
        aliasTargetKey: null,
        modeId: "m2",
        collectionKey: "d",
      },
    ]),
    [
      ["a", "b"],
      ["b", null],
    ],
  );
  for (const text of ["", "abc", "中文", "😀", "a\ud800b"]) {
    assert.equal(contract.utf8Length(text), Buffer.byteLength(text, "utf8"));
  }
});
