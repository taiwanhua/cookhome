import assert from "node:assert/strict";
import { test } from "node:test";

import { createSourceRuntime } from "./runtime-source.mjs";
import {
  CONSUMER_FILE,
  buildBaseLibrary,
  buildConsumer,
  core,
  createFakeFigma,
  createWorld,
  fixed,
  swapInstance,
} from "./test-support.mjs";

function setup() {
  const world = createWorld();
  const base = buildBaseLibrary(world);
  const consumer = buildConsumer(world, base);
  const source = createSourceRuntime(
    createFakeFigma(world, CONSUMER_FILE),
    core,
  );
  return { world, base, consumer, source };
}
/** 沿實際 child-index 路徑往下走。 */
async function walk(source, context, node, path) {
  let current = context;
  let parent = node;
  for (const index of path) {
    const child = parent.children[index];
    current = await source.descend(current, parent, index, child);
    parent = child;
  }
  return { context: current, node: parent };
}

test("instance root 對自己的 main component:exact-root,來源鏈為空", async () => {
  const { source, base, consumer } = setup();
  const { button } = consumer.nodes;
  const context = source.rootContext(
    button,
    await button.getMainComponentAsync(),
  );
  assert.equal(context.status, "exact-root");
  assert.equal(context.rootInstanceId, "10:2");
  assert.equal(context.componentKey, base.components.button.key);
  assert.equal(context.sourceNode, base.components.button);
  assert.deepEqual(context.ancestryPath, []);
  assert.deepEqual(source.matchOf(context, CONSUMER_FILE), {
    status: "exact-root",
    componentKey: base.components.button.key,
    nodeContextFileKey: CONSUMER_FILE,
    sourceNodeId: "1:10",
    ancestryPath: [],
    paintShape: null,
    sourceSlot: null,
    sourceInventoryDigest: null,
    consumerInventoryDigest: null,
    previousReceiptDigest: null,
    reason: null,
  });
});

test("巢狀 instance 的 main key 相同:保留祖先來源樹中的 source instance context", async () => {
  const { source, base, consumer } = setup();
  const { sideNav } = consumer.nodes;
  const root = source.rootContext(
    sideNav,
    await sideNav.getMainComponentAsync(),
  );
  const { context } = await walk(source, root, sideNav, [1]);
  assert.equal(context.status, "validated-structure");
  // 來源是 SideNav 內的 NavItem instance(帶來源自己的覆寫),不是孤立的 NavItem master
  assert.equal(context.sourceNode.id, "1:41");
  assert.notEqual(context.sourceNode, base.components.navItem);
  assert.deepEqual(context.ancestryPath, [
    {
      consumerParentId: "10:5",
      sourceParentId: "1:40",
      childIndex: 1,
      consumerType: "INSTANCE",
      sourceType: "INSTANCE",
      consumerChildCount: 4,
      sourceChildCount: 4,
      nestedComponentKey: base.components.navItem.key,
    },
  ]);
  assert.deepEqual(context.swaps, []);
  // 再往下一層仍沿來源 instance 的子樹
  const text = await walk(source, context, sideNav.children[1], [0]);
  assert.equal(text.context.sourceNode.id, "I1:41;1:31");
  assert.equal(text.context.ancestryPath.length, 2);
  assert.equal(text.context.rootInstanceId, "10:5");
});

test("巢狀 instance 的 main key 不同:視為 swap,改以 consumer 的 actual main 為新來源範圍", async () => {
  const { source, base, consumer } = setup();
  const { sideNav } = consumer.nodes;
  const root = source.rootContext(
    sideNav,
    await sideNav.getMainComponentAsync(),
  );
  const { context } = await walk(source, root, sideNav, [3]);
  assert.equal(context.sourceNode, base.components.iconB);
  assert.equal(
    context.ancestryPath[0].nestedComponentKey,
    base.components.iconB.key,
  );
  assert.deepEqual(context.swaps, [
    {
      kind: "instance-swap",
      nodeId: "I10:5;1:44",
      sourceComponentKey: base.components.iconA.key,
      consumerComponentKey: base.components.iconB.key,
    },
  ]);
  const vector = await walk(source, context, sideNav.children[3], [0]);
  assert.equal(vector.context.sourceNode.id, "1:26");
  assert.equal(vector.context.ancestryPath[1].sourceParentId, "1:25");
  // 根元件 key 不因 swap 改寫;swap 記在路徑與 overrides
  assert.equal(vector.context.componentKey, base.components.sideNav.key);
});

test("type 或 child count 不符、main 取不到:unresolved,且不會在更深處自行恢復", async () => {
  const { world, source, base, consumer } = setup();
  const { dialog, sideNav, button } = consumer.nodes;
  const root = source.rootContext(dialog, await dialog.getMainComponentAsync());
  // 來源多了一層:child count 不同
  base.components.dialog.children[1].append(
    world.node(base.fileKey, { id: "1:59", type: "FRAME", children: [] }),
  );
  const counted = await walk(source, root, dialog, [1, 0]);
  assert.equal(counted.context.status, "unresolved");
  assert.equal(counted.context.reason, "STRUCTURE_MISMATCH");
  assert.equal(counted.context.sourceNode, null);
  const deeper = await walk(source, counted.context, counted.node, [1]);
  assert.equal(deeper.context.reason, "STRUCTURE_MISMATCH");
  assert.equal(
    source.matchOf(deeper.context, CONSUMER_FILE).sourceNodeId,
    null,
  );

  // 同 index 但型別不同(同名或同形不等於同身分)
  const sideRoot = source.rootContext(
    sideNav,
    await sideNav.getMainComponentAsync(),
  );
  sideNav.children[0].type = "FRAME";
  const typed = await walk(source, sideRoot, sideNav, [0]);
  assert.equal(typed.context.reason, "STRUCTURE_MISMATCH");
  assert.equal(typed.context.ancestryPath[0].consumerType, "FRAME");
  assert.equal(typed.context.ancestryPath[0].sourceType, "TEXT");

  // 巢狀 instance 的 main 取不到
  sideNav.children[1].mainComponent = null;
  const broken = await walk(source, sideRoot, sideNav, [1]);
  assert.equal(broken.context.reason, "BROKEN_INSTANCE");
  assert.equal(source.rootContext(button, null).reason, "BROKEN_INSTANCE");
});

test("不在任何 instance 內:沒有來源對照,reason=NOT_IN_INSTANCE", () => {
  const { source } = setup();
  const match = source.matchOf(null, CONSUMER_FILE);
  assert.equal(match.status, "unresolved");
  assert.equal(match.reason, "NOT_IN_INSTANCE");
  assert.equal(match.componentKey, null);
  assert.deepEqual(match.ancestryPath, []);
});

test("paint 只有 count 與逐項 type 一致才算可對應", () => {
  const { source } = setup();
  const image = { type: "IMAGE" };
  assert.deepEqual(source.paintShape([fixed(), image], [fixed(), image]), {
    shape: {
      consumerCount: 2,
      sourceCount: 2,
      consumerPaintTypes: ["SOLID", "IMAGE"],
      sourcePaintTypes: ["SOLID", "IMAGE"],
    },
    aligned: true,
  });
  assert.equal(
    source.paintShape([fixed(), image], [image, fixed()]).aligned,
    false,
  );
  assert.equal(source.paintShape([fixed()], []).aligned, false);
  // 來源或 consumer 是 mixed(非陣列):沒有 shape 可比
  assert.deepEqual(source.paintShape([fixed()], Symbol("mixed")), {
    shape: null,
    aligned: false,
  });
});

test("swap 之後再 swap 回原元件:main key 又相同,回到來源 instance context", async () => {
  const { world, source, base, consumer } = setup();
  const { sideNav } = consumer.nodes;
  swapInstance(world, sideNav.children[3], base.components.iconA);
  const root = source.rootContext(
    sideNav,
    await sideNav.getMainComponentAsync(),
  );
  const { context } = await walk(source, root, sideNav, [3]);
  assert.equal(context.sourceNode.id, "1:44");
  assert.deepEqual(context.swaps, []);
});
