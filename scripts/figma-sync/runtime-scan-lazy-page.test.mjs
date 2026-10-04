import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildExecutionSource,
  buildReadonlyTransportSource,
} from "./execution-source.mjs";
import { createRuntime } from "./runtime.mjs";
import {
  CONSUMER_FILE,
  buildBaseLibrary,
  buildConsumer,
  createFakeFigma,
  createWorld,
  executeSource,
  makeRequest,
} from "./test-support.mjs";
import { createNodeTransport } from "./transport-codec.mjs";

function setup() {
  const world = createWorld();
  const base = buildBaseLibrary(world);
  const consumer = buildConsumer(world, base);
  const file = world.files.get(CONSUMER_FILE);
  const first = world.node(CONSUMER_FILE, {
    id: "90:1",
    type: "PAGE",
    name: "Cover",
    children: [],
  });
  file.pages.unshift(first);
  file.currentPage = first;
  const figma = createFakeFigma(world, CONSUMER_FILE);
  const lookup = figma.getNodeByIdAsync;
  figma.getNodeByIdAsync = async (id) => {
    const node = await lookup(id);
    if (node && id.startsWith("I")) {
      let page = node;
      while (page && page.type !== "PAGE") page = page.parent;
      if (page?.id !== figma.currentPage.id) return null;
    }
    return node;
  };
  return { world, consumer, file, figma, first };
}

const request = (roots) =>
  makeRequest({
    targetKind: "consumer",
    fileKey: CONSUMER_FILE,
    roots,
    runId: "lazy-page",
  });

test("非首頁的巢狀 roots 先定位頁面,只掃精確 roots 且保留來源脈絡", async () => {
  const { world, consumer, file, figma, first } = setup();
  const runtime = createRuntime(figma);
  const whole = await runtime.scanScope(request(["10:5", "10:6"]));
  file.currentPage = first;
  world.pageSwitches = 0;
  const roots = ["I10:5;1:41", "I10:6;1:55"];
  const narrow = await runtime.scanScope(request(roots));
  assert.deepEqual(narrow.issues, []);
  assert.deepEqual(narrow.scope.pageIds, [consumer.page.id]);
  assert.equal(world.pageSwitches, 1);
  for (const root of roots) {
    assert.equal(narrow.nodes.find((n) => n.nodeId === root).scopeRootId, root);
    const slot = narrow.slots.find((s) => s.locator.nodeId === root);
    assert.deepEqual(
      slot.sourceMatch,
      whole.slots.find((s) => s.locator.nodeId === root).sourceMatch,
    );
  }
  assert.equal(narrow.nodes.find((n) => n.nodeId === "10:5").scopeRootId, null);
  assert.deepEqual(world.mutations, []);
  // 真生成碼也要走同一個載入行為;下一次呼叫從首頁開始。
  file.currentPage = first;
  world.pageSwitches = 0;
  const source = await buildExecutionSource({ request: request(roots) });
  const envelope = await executeSource(source, figma);
  assert.equal(envelope.type, "head");
  assert.equal(world.pageSwitches, 1);
  const chunks = [];
  for (let index = 0; index < envelope.payload.chunkCount; index += 1) {
    file.currentPage = first;
    chunks.push(
      await executeSource(
        buildReadonlyTransportSource({
          request: request(roots),
          head: envelope,
          index,
        }),
        figma,
      ),
    );
  }
  const generated = createNodeTransport().assemble(
    request(roots),
    envelope,
    chunks,
  );
  assert.deepEqual(
    { ...generated, generatedAt: "T" },
    { ...narrow, generatedAt: "T" },
  );
  assert.deepEqual(world.mutations, []);
});

test("巢狀 root 的 host 只供找頁面,缺節點不擴大 scope,跨頁在切頁前拒絕", async () => {
  const { world, figma, first } = setup();
  const runtime = createRuntime(figma);
  const mixed = await runtime.scanScope(request([first.id, "I10:5;1:41"]));
  assert.deepEqual(
    mixed.issues.map((i) => i.code),
    ["ROOTS_NOT_SAME_PAGE"],
  );
  assert.equal(world.pageSwitches, 0);
  const missing = await runtime.scanScope(request(["I10:5;99:99"]));
  assert.deepEqual(
    missing.issues.map((i) => i.code),
    ["ROOT_NOT_FOUND"],
  );
  assert.deepEqual(missing.nodes, []);
  assert.deepEqual(missing.slots, []);
  assert.equal(world.pageSwitches, 1);
  assert.deepEqual(world.mutations, []);
});
