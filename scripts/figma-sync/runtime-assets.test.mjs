import assert from "node:assert/strict";
import { test } from "node:test";

import { createAssetRuntime } from "./runtime-assets.mjs";
import {
  BASE_FILE,
  CONSUMER_FILE,
  bound,
  buildBaseLibrary,
  buildConsumer,
  core,
  createFakeFigma,
  createWorld,
  fixed,
} from "./test-support.mjs";

function setup() {
  const world = createWorld();
  const base = buildBaseLibrary(world);
  const consumer = buildConsumer(world, base);
  const figma = createFakeFigma(world, CONSUMER_FILE);
  return {
    world,
    base,
    consumer,
    figma,
    assets: createAssetRuntime(figma, core),
  };
}
const aliasTo = (variable) => ({ type: "VARIABLE_ALIAS", id: variable.id });

test("alias 逐步解析到實際來源,每一步保存 key / collection / mode / type / target", async () => {
  const { assets, base } = setup();
  const result = await assets.resolveChain(base.color.main, {});
  assert.equal(result.code, null);
  assert.deepEqual(
    result.aliasChain.map((step) => [
      step.variableKey,
      step.resolvedType,
      step.aliasTargetKey,
    ]),
    [
      [base.color.main.key, "COLOR", base.brand.main.key],
      [base.brand.main.key, "COLOR", null],
    ],
  );
  assert.notEqual(
    result.aliasChain[0].collectionKey,
    result.aliasChain[1].collectionKey,
  );
  assert.ok(result.aliasChain.every((step) => typeof step.modeId === "string"));
  assert.equal(result.resolved.kind, "rgba");
  assert.equal(result.resolved.rgba.a, 1);
});

test("依節點實際生效的 mode 解析;同一變數在不同 consumer mode 得到不同鏈", async () => {
  const { world, assets } = setup();
  const collection = world.addCollection(CONSUMER_FILE, "Themed", [
    "Light",
    "Dark",
  ]);
  const [light, dark] = collection.modes.map((mode) => mode.modeId);
  const variable = world.addVariable(CONSUMER_FILE, "surface", collection, {
    [light]: { r: 1, g: 1, b: 1, a: 1 },
    [dark]: { r: 0, g: 0, b: 0, a: 1 },
  });
  const byDefault = await assets.resolveChain(variable, {});
  const inDark = await assets.resolveChain(variable, {
    resolvedVariableModes: { [collection.id]: dark },
  });
  assert.equal(byDefault.aliasChain[0].modeId, light);
  assert.equal(inDark.aliasChain[0].modeId, dark);
  assert.equal(byDefault.resolved.rgba.r, 1);
  assert.equal(inDark.resolved.rgba.r, 0);
  // 節點指定了這個集合沒有的 mode:明確失敗,不退回預設
  const missing = await assets.resolveChain(variable, {
    resolvedVariableModes: { [collection.id]: "gone" },
  });
  assert.equal(missing.code, "ALIAS_MODE_MISSING");
  assert.equal(missing.resolved, null);
});

test("cycle、缺目標、深度超限都回明確 code,不回傳猜測值", async () => {
  const { world, assets } = setup();
  const collection = world.addCollection(CONSUMER_FILE, "Loop", ["Light"]);
  const mode = collection.defaultModeId;
  const make = (name) => world.addVariable(CONSUMER_FILE, name, collection);
  const a = make("a");
  const b = make("b");
  a.valuesByMode[mode] = aliasTo(b);
  b.valuesByMode[mode] = aliasTo(a);
  assert.equal((await assets.resolveChain(a, {})).code, "ALIAS_CYCLE");

  const orphan = make("orphan");
  orphan.valuesByMode[mode] = { type: "VARIABLE_ALIAS", id: "VariableID:gone" };
  const lost = await assets.resolveChain(orphan, {});
  assert.equal(lost.code, "ALIAS_TARGET_MISSING");
  assert.equal(lost.aliasChain[0].aliasTargetKey, null);

  const chain = Array.from({ length: 10 }, (_, index) => make(`deep${index}`));
  chain.forEach((variable, index) => {
    if (index < 9) variable.valuesByMode[mode] = aliasTo(chain[index + 1]);
  });
  const deep = await assets.resolveChain(chain[0], {});
  assert.equal(deep.code, "ALIAS_DEPTH_EXCEEDED");
  assert.equal(deep.aliasChain.length, 8);
  assert.equal(deep.resolved, null);
});

test("paint / style 現值:固定色、變數 key、mixed、missing 分開表示;本地 ID 只定位", async () => {
  const { world, base, figma, assets } = setup();
  assert.equal(assets.fileKey(), CONSUMER_FILE);
  const fixedValue = await assets.paintValue(fixed({ r: 0.5, g: 0.25, b: 0 }));
  assert.deepEqual(fixedValue.value, {
    kind: "fixed",
    rgba: { r: 0.5, g: 0.25, b: 0, a: 1 },
  });
  const variableValue = await assets.paintValue(bound(base.color.main));
  assert.deepEqual(variableValue.value, {
    kind: "variable",
    key: base.color.main.key,
    localId: base.color.main.id,
    remote: true,
  });
  const gone = await assets.paintValue(bound({ id: "VariableID:gone" }));
  assert.deepEqual(gone.value, { kind: "missing" });

  assert.equal(await assets.styleValue({ effectStyleId: "" }), null);
  assert.deepEqual(
    (await assets.styleValue({ effectStyleId: figma.mixed })).value,
    {
      kind: "mixed",
    },
  );
  assert.deepEqual(
    (await assets.styleValue({ effectStyleId: "S:gone" })).value,
    {
      kind: "missing",
    },
  );
  const style = await assets.styleValue({ effectStyleId: base.shadow.id });
  assert.equal(style.value.key, base.shadow.key);
  assert.equal(style.value.remote, true);
  assert.equal(world.mutations.length, 0);
});

test("資產登記:本檔資產帶 fileKey,遠端資產的來源檔讀不到就記 null", async () => {
  const { assets, base, consumer } = setup();
  await assets.listLocalAssets();
  await assets.resolveChain(base.color.main, {});
  const collected = assets.collectedAssets();
  const find = (key) => collected.find((asset) => asset.key === key);
  assert.equal(find(consumer.privateColor.key).fileKey, CONSUMER_FILE);
  assert.equal(find(base.color.main.key).fileKey, null);
  assert.equal(find(base.brand.main.key).fileKey, null);
  const remote = find(base.color.main.key);
  assert.deepEqual(Object.values(remote.valueOrEffects.valuesByMode), [
    { kind: "alias", variableKey: base.brand.main.key },
  ]);
  assert.equal(remote.modes[0].name, "Light");
});

test("陰影 view 保存 type / 色 / alpha / offset / radius / spread / visible / blendMode", () => {
  const { assets } = setup();
  const [view] = assets.effectsView([
    {
      type: "DROP_SHADOW",
      color: { r: 0.1, g: 0.2, b: 0.3, a: 0.24 },
      offset: { x: 0, y: 8 },
      radius: 16,
      visible: true,
      blendMode: "NORMAL",
      showShadowBehindNode: false,
    },
  ]);
  assert.deepEqual(view, {
    type: "DROP_SHADOW",
    radius: 16,
    visible: true,
    color: { r: 0.1, g: 0.2, b: 0.3, a: 0.24 },
    offset: { x: 0, y: 8 },
    spread: 0,
    blendMode: "NORMAL",
  });
  assert.equal(
    assets.effectBindings([
      { type: "DROP_SHADOW", boundVariables: { color: { id: "x" } } },
      { type: "DROP_SHADOW", boundVariables: {} },
    ]),
    1,
  );
});

test("exact import:取回的 key 或型別不符就失敗;未發布的 key 匯不進來", async () => {
  const { world, base, assets } = setup();
  const variable = await assets.importByKey("variable", base.color.main.key);
  assert.equal(variable.key, base.color.main.key);
  const style = await assets.importByKey("effect-style", base.shadow.key);
  assert.equal(style.key, base.shadow.key);
  base.color.dark.unpublished = true;
  await assert.rejects(assets.importByKey("variable", base.color.dark.key));

  const lying = createFakeFigma(world, CONSUMER_FILE);
  lying.variables.importVariableByKeyAsync = async () => base.color.light;
  await assert.rejects(
    createAssetRuntime(lying, core).importByKey(
      "variable",
      base.color.main.key,
    ),
    /IMPORT_NOT_EXACT/,
  );
  // 本檔資產以 key 精確尋找;別檔的 key 找不到
  const own = createAssetRuntime(createFakeFigma(world, BASE_FILE), core);
  assert.equal(
    (await own.findLocal("variable", base.color.main.key)).id,
    base.color.main.id,
  );
  assert.equal(await assets.findLocal("variable", base.color.main.key), null);
});
