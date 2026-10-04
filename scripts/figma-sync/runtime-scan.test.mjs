import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BASE_FILE,
  CONSUMER_FILE,
  bound,
  buildBaseLibrary,
  buildConsumer,
  createWorld,
  fixed,
  instantiate,
  scan,
} from "./test-support.mjs";

function setup() {
  const world = createWorld();
  const base = buildBaseLibrary(world);
  const consumer = buildConsumer(world, base);
  return { world, base, consumer };
}
const scanConsumer = (world, roots = ["10:1"], runId = "scan-1") =>
  scan(world, "consumer", CONSUMER_FILE, roots, runId);
const nodeOf = (inventory, nodeId) =>
  inventory.nodes.find((node) => node.nodeId === nodeId);
const scopeOf = (inventory, slot) =>
  nodeOf(inventory, slot.locator.nodeId).scopeRootId;
const slotsOf = (inventory, nodeId) =>
  inventory.slots.filter((slot) => slot.locator.nodeId === nodeId);
const codes = (inventory) => inventory.issues.map((issue) => issue.code);

test("完整 scope:roots 與所有後代(含隱藏)各有一筆 node 觀測,全程唯讀、最多切頁一次", async () => {
  const { world, consumer } = setup();
  const inventory = await scanConsumer(world);
  assert.equal(world.mutations.length, 0);
  assert.equal(world.pageSwitches, 0);
  assert.equal(inventory.observedFileKey, CONSUMER_FILE);
  assert.deepEqual(inventory.scope, {
    fileKey: CONSUMER_FILE,
    rootNodeIds: ["10:1"],
    pageIds: [consumer.page.id],
    includeHidden: true,
  });
  assert.deepEqual(inventory.coverage, {
    nodes: 24,
    instances: 9,
    remoteInstances: 9,
    hiddenNodes: 2,
    brokenInstances: 0,
    unsupportedNodes: 0,
  });
  assert.deepEqual(inventory.issues, []);
  const inside = inventory.nodes.filter((node) => node.scopeRootId === "10:1");
  assert.equal(inside.length, 24);
  // 隱藏的備用槽與它的後代都有 node 與 slot
  assert.equal(
    nodeOf(inventory, "I10:5;1:42").protectedSnapshot.visible,
    false,
  );
  assert.equal(slotsOf(inventory, "I10:5;1:42").length, 1);
  assert.equal(slotsOf(inventory, "I10:5;I1:42;1:31").length, 1);
  // 沒有任何可補套 slot 的節點(icon instance、Dialog 內的 frame)一樣被保護
  for (const nodeId of ["I10:5;1:44", "I10:6;1:52", "I10:6;1:53"]) {
    assert.equal(slotsOf(inventory, nodeId).length, 0);
    assert.equal(nodeOf(inventory, nodeId).scopeRootId, "10:1");
  }
  // 範圍證據:祖先鏈由近到遠,最後是 page
  assert.deepEqual(nodeOf(inventory, "I10:6;1:55").ancestorIds, [
    "I10:6;1:53",
    "I10:6;1:52",
    "10:6",
    "10:1",
    consumer.page.id,
  ]);
  assert.equal(nodeOf(inventory, "10:1").pageId, consumer.page.id);
  // slot 帶的 snapshot 就是它所屬節點的那一份
  for (const slot of inventory.slots) {
    assert.deepEqual(
      slot.protectedSnapshot,
      nodeOf(inventory, slot.locator.nodeId).protectedSnapshot,
    );
  }
});

test("locator 與現值:field / index 對應 fills[i]、strokes[i]、effectStyleId", async () => {
  const { world, base, consumer } = setup();
  const inventory = await scanConsumer(world);
  const button = slotsOf(inventory, "10:2");
  assert.deepEqual(
    button.map((slot) => [
      slot.locator.field,
      slot.locator.index,
      slot.value.key,
    ]),
    [
      ["fill-color", 0, base.color.main.key],
      ["stroke-color", 0, base.color.dark.key],
      ["effect-style", null, base.shadow.key],
    ],
  );
  assert.ok(button.every((slot) => slot.locator.rootInstanceId === "10:2"));
  assert.equal(button[2].resolvedValue.effects[0].color.a, 0.24);
  // IMAGE paint 不是 slot;同節點第二個 fill 的 index 仍是 1
  const image = slotsOf(inventory, "10:7");
  assert.deepEqual(
    image.map((slot) => slot.locator.index),
    [1],
  );
  assert.equal(image[0].locator.rootInstanceId, null);
  // 私有變數:本檔資產、HEX 與底座主色相同,value 仍是它自己的 key
  const privateSlot = slotsOf(inventory, "10:4")[0];
  assert.equal(privateSlot.value.key, consumer.privateColor.key);
  assert.equal(privateSlot.value.remote, false);
  assert.deepEqual(privateSlot.resolvedValue, button[0].resolvedValue);
  assert.deepEqual(privateSlot.observedOverrides, [
    {
      kind: "binding",
      sourceBindingKey: base.color.main.key,
      consumerKind: "variable",
      consumerKey: consumer.privateColor.key,
    },
  ]);
});

test("scope 外只在同頁取控制值;範圍內節點不會被當成控制,coverage 只算範圍內", async () => {
  const { world, consumer } = setup();
  world.addFile(CONSUMER_FILE + "x");
  const inventory = await scanConsumer(world, ["10:2", "10:5"]);
  const controls = inventory.nodes.filter((node) => node.scopeRootId === null);
  const controlIds = new Set(controls.map((node) => node.nodeId));
  assert.ok(controlIds.has("10:1"));
  assert.ok(controlIds.has("10:3"));
  assert.ok(controlIds.has("20:2"));
  assert.ok(!controlIds.has("10:2"));
  assert.ok(!controlIds.has("I10:5;1:41"));
  assert.ok(controls.every((node) => node.pageId === consumer.page.id));
  assert.deepEqual(
    Array.from(
      new Set(
        inventory.slots
          .map((slot) => scopeOf(inventory, slot))
          .filter((id) => id !== null),
      ),
    ),
    ["10:2", "10:5"],
  );
  assert.equal(inventory.coverage.instances, 5);
  // root 已是另一個 root 的後代時不重複掃
  const nestedRoots = await scanConsumer(world, ["10:1", "10:2"]);
  const keys = nestedRoots.nodes.map((node) => node.nodeId);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(nestedRoots.coverage.nodes, 24);
});

test("控制值有上限,不會把整頁都掃進來", async () => {
  const { world, consumer } = setup();
  for (let index = 0; index < 260; index += 1) {
    consumer.control.append(
      world.node(CONSUMER_FILE, {
        id: `30:${index}`,
        type: "RECTANGLE",
        fills: [fixed()],
      }),
    );
  }
  const inventory = await scanConsumer(world);
  const controls = inventory.nodes.filter((node) => node.scopeRootId === null);
  assert.equal(controls.length, 200);
});

test("roots 必須在同一頁;切頁最多一次,缺 root 或跨頁都不掃描", async () => {
  const { world, base, consumer } = setup();
  const second = world.node(CONSUMER_FILE, {
    id: `P${CONSUMER_FILE}:1`,
    type: "PAGE",
    name: "Other",
    children: [],
  });
  world.files.get(CONSUMER_FILE).pages.push(second);
  const far = second.append(
    instantiate(world, CONSUMER_FILE, base.components.button, "40:1"),
  );
  const other = await scanConsumer(world, [far.id]);
  assert.equal(world.pageSwitches, 1);
  assert.deepEqual(other.scope.pageIds, [second.id]);
  assert.equal(other.coverage.instances, 1);
  // 控制值只取同一頁:第一頁的節點不在這次 inventory
  assert.equal(nodeOf(other, "10:1"), undefined);

  const mixed = await scanConsumer(world, ["10:1", far.id]);
  assert.deepEqual(codes(mixed), ["ROOTS_NOT_SAME_PAGE"]);
  assert.deepEqual(mixed.nodes, []);
  const missing = await scanConsumer(world, ["10:1", "99:9"]);
  assert.deepEqual(codes(missing), ["ROOT_NOT_FOUND"]);
  assert.equal(missing.issues[0].locator, undefined);
  assert.deepEqual(missing.slots, []);
  // 被拒絕的 request 不切頁;回到第一頁的掃描才再切一次
  assert.equal(world.pageSwitches, 1);
  const back = await scanConsumer(world, ["10:1"]);
  assert.deepEqual(back.scope.pageIds, [consumer.page.id]);
  assert.equal(world.pageSwitches, 2);
});

test("以 instance 內部節點縮小 scope:來源脈絡從祖先 instance 建立,結果與整頁掃描相同", async () => {
  const { world, base } = setup();
  const whole = await scanConsumer(world, ["10:1"]);
  const pick = (inventory, nodeId) => slotsOf(inventory, nodeId)[0];
  // root 是 SideNav 內的 nested NavItem instance(帶來源自己的 lighter 覆寫)
  const nested = await scanConsumer(world, ["I10:5;1:41"]);
  const slot = pick(nested, "I10:5;1:41");
  assert.deepEqual(slot.sourceMatch, pick(whole, "I10:5;1:41").sourceMatch);
  assert.deepEqual(slot.locator, pick(whole, "I10:5;1:41").locator);
  assert.equal(slot.sourceMatch.sourceSlot.bindingKey, base.color.lighter.key);
  assert.equal(slot.locator.rootInstanceId, "10:5");
  assert.equal(nodeOf(nested, "I10:5;1:41").scopeRootId, "I10:5;1:41");
  // 祖先只讀、不擴大範圍:SideNav 本身只是控制節點
  assert.equal(nodeOf(nested, "10:5").scopeRootId, null);
  assert.equal(nested.coverage.nodes, 2);
  // root 是 instance 內的一般圖層(Dialog 的 dot 與它的 frame)
  for (const rootId of ["I10:6;1:55", "I10:6;1:53"]) {
    const inner = await scanConsumer(world, [rootId]);
    assert.deepEqual(
      pick(inner, "I10:6;1:55").sourceMatch,
      pick(whole, "I10:6;1:55").sourceMatch,
    );
    assert.notEqual(
      pick(inner, "I10:6;1:55").sourceMatch.reason,
      "NOT_IN_INSTANCE",
    );
  }
  // 頂層 instance 當 root 也一致
  const top = await scanConsumer(world, ["10:5"]);
  assert.deepEqual(
    pick(top, "I10:5;1:41").sourceMatch,
    pick(whole, "I10:5;1:41").sourceMatch,
  );
});

test("Library 資產全檔列舉;variant 以 COMPONENT_SET 為 publication owner 且不改寫各自狀態", async () => {
  const world = createWorld();
  const base = buildBaseLibrary(world);
  const variant = (id, status) =>
    world.node(BASE_FILE, {
      id,
      type: "COMPONENT",
      name: "State=Default",
      key: world.nextKey("comp"),
      publishStatus: status,
      fills: [bound(base.color.main)],
    });
  const set = world.node(BASE_FILE, {
    id: "2:1",
    type: "COMPONENT_SET",
    name: "Tab",
    key: world.nextKey("set"),
    publishStatus: "CURRENT",
    children: [variant("2:2", "UNPUBLISHED"), variant("2:3", "CURRENT")],
  });
  base.page.append(set);
  const inventory = await scan(
    world,
    "base-library",
    BASE_FILE,
    [base.page.id],
    "scan-base",
  );
  assert.deepEqual(
    inventory.publicationOwners.find((item) => item.componentNodeId === "2:2"),
    {
      componentKey: set.children[0].key,
      componentNodeId: "2:2",
      rawStatus: "UNPUBLISHED",
      ownerKind: "COMPONENT_SET",
      ownerKey: set.key,
      ownerNodeId: "2:1",
      ownerRawStatus: "CURRENT",
    },
  );
  const standalone = inventory.publicationOwners.find(
    (item) => item.componentNodeId === "1:10",
  );
  assert.equal(standalone.ownerKind, "COMPONENT");
  assert.equal(standalone.ownerKey, standalone.componentKey);
  const kinds = (kind) =>
    inventory.assets.filter((asset) => asset.kind === kind);
  assert.equal(kinds("collection").length, 2);
  assert.equal(kinds("variable").length, 14);
  assert.equal(kinds("effect-style").length, 2);
  assert.ok(inventory.assets.every((asset) => asset.fileKey === BASE_FILE));
  // 整頁是 root 時沒有 scope 外控制節點
  assert.ok(inventory.nodes.every((node) => node.scopeRootId === base.page.id));
});

test("未支援或讀不到的綁定明列 issue:mixed text、gradient、effect、broken instance", async () => {
  const { world, base, consumer } = setup();
  const { button, image, sideNav } = consumer.nodes;
  const label = button.children[0];
  label.fills = world.mixed;
  label.segments = [
    { fills: [bound(base.color.contrast)] },
    { fills: [fixed()] },
  ];
  image.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 1 },
      offset: { x: 0, y: 1 },
      radius: 2,
      visible: true,
      blendMode: "NORMAL",
      boundVariables: {
        color: { type: "VARIABLE_ALIAS", id: base.color.main.id },
      },
    },
  ];
  sideNav.children[1].mainComponent = null;
  const inventory = await scanConsumer(world);
  const byCode = (code) =>
    inventory.issues.filter((issue) => issue.code === code);
  assert.deepEqual(
    byCode("UNSUPPORTED_BINDING").map((issue) => [
      issue.locator.nodeId,
      issue.assetKey,
    ]),
    [
      ["I10:2;1:11", base.color.contrast.key],
      ["10:7", base.color.main.key],
    ],
  );
  const mixed = slotsOf(inventory, "I10:2;1:11")[0];
  assert.deepEqual(mixed.value, { kind: "mixed" });
  assert.equal(mixed.sourceMatch.reason, "UNSUPPORTED_BINDING");
  assert.equal(mixed.protectedSnapshot.fills, "mixed");
  assert.equal(inventory.coverage.unsupportedNodes, 2);
  assert.equal(inventory.coverage.brokenInstances, 1);
  assert.equal(byCode("BROKEN_INSTANCE")[0].locator.nodeId, "I10:5;1:41");
  const broken = slotsOf(inventory, "I10:5;1:41")[0];
  assert.equal(broken.sourceMatch.status, "unresolved");
  assert.equal(broken.sourceMatch.reason, "BROKEN_INSTANCE");
  assert.equal(broken.sourceMatch.sourceSlot, null);
});
