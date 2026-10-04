import assert from "node:assert/strict";
import { test } from "node:test";

import { createAssetRuntime } from "./runtime-assets.mjs";
import { createNodeSnapshots } from "./runtime-scan-snapshot.mjs";
import {
  CONSUMER_FILE,
  buildBaseLibrary,
  buildConsumer,
  core,
  createFakeFigma,
  createWorld,
} from "./test-support.mjs";

function setup() {
  const world = createWorld();
  const base = buildBaseLibrary(world);
  const consumer = buildConsumer(world, base);
  const figma = createFakeFigma(world, CONSUMER_FILE);
  const snapshots = createNodeSnapshots(figma, createAssetRuntime(figma, core));
  return { world, base, consumer, snapshots };
}

test("snapshot:文字、圖片 hash、paint 其他欄位、visible、nested main、幾何;不含 SOLID 的色與綁定", async () => {
  const { base, consumer, snapshots } = setup();
  const { nodes } = consumer;
  nodes.customButton.children[0].characters = "自訂文字";
  const text = await snapshots.snapshot(nodes.customButton.children[0]);
  assert.equal(text.nodeType, "TEXT");
  assert.equal(text.characters, "自訂文字");
  const image = await snapshots.snapshot(nodes.image);
  assert.deepEqual(
    image.fills.map((paint) => [paint.type, paint.imageHash, paint.opacity]),
    [
      ["IMAGE", "hash-logo", 1],
      ["SOLID", null, 0.5],
    ],
  );
  // SOLID 的色與綁定是 slot.value(由 action 精確比對);補套前後 snapshot 才能逐欄相等
  assert.deepEqual(Object.keys(image.fills[1]), [
    "type",
    "visible",
    "opacity",
    "blendMode",
    "imageHash",
    "gradientStops",
  ]);
  const button = await snapshots.snapshot(nodes.button);
  assert.equal(button.mainComponentKey, base.components.button.key);
  assert.equal(button.geometry.cornerRadius, 8);
  assert.equal(button.geometry.width, 100);
  assert.equal(button.childCount, 1);
  // 套了 effect style 的節點不另存 effects(會隨 style 改變)
  assert.equal(button.effects, null);
  assert.equal(button.visible, true);
  nodes.button.visible = false;
  assert.equal((await snapshots.snapshot(nodes.button)).visible, false);
});

test("沒有任何 paint 的節點一樣有完整觀測:container、nested instance", async () => {
  const { base, consumer, snapshots } = setup();
  const icon = consumer.nodes.sideNav.children[3];
  const observed = await snapshots.observe(icon, "10:1");
  assert.deepEqual(observed, {
    nodeId: "I10:5;1:44",
    pageId: consumer.page.id,
    scopeRootId: "10:1",
    ancestorIds: ["10:5", "10:1", consumer.page.id],
    protectedSnapshot: {
      nodeType: "INSTANCE",
      visible: true,
      characters: null,
      mainComponentKey: base.components.iconB.key,
      childCount: 1,
      geometry: observed.protectedSnapshot.geometry,
      fills: null,
      strokes: null,
      effects: null,
    },
  });
  // scope 外控制節點:scopeRootId 為 null,祖先鏈照記
  const control = await snapshots.observe(consumer.control, null);
  assert.equal(control.scopeRootId, null);
  assert.deepEqual(control.ancestorIds, [consumer.page.id]);
  // page 本身當節點時 pageId 是自己
  const page = await snapshots.observe(consumer.page, consumer.page.id);
  assert.equal(page.pageId, consumer.page.id);
  assert.deepEqual(page.ancestorIds, []);
});

test("未套 style 的 raw effects 與 mixed fills 都進 snapshot", async () => {
  const { world, consumer, snapshots } = setup();
  const { image, button } = consumer.nodes;
  image.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.5 },
      offset: { x: 0, y: 2 },
      radius: 4,
      visible: true,
      blendMode: "NORMAL",
    },
  ];
  const raw = await snapshots.snapshot(image);
  assert.equal(raw.effects[0].color.a, 0.5);
  assert.equal(raw.effects[0].radius, 4);
  button.children[0].fills = world.mixed;
  assert.equal((await snapshots.snapshot(button.children[0])).fills, "mixed");
});
