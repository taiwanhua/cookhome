import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import vm from "node:vm";

import { CORE_FACTORIES, assembleCore } from "./core.mjs";
import {
  APPLY_ENTRY_FACTORIES,
  ASSET_APPLY_ENTRY_FACTORIES,
  MAX_TOOL_ARGUMENT_BYTES,
  MAX_TOOL_CODE_CHARS,
  SCAN_ENTRY_FACTORIES,
  SCENE_APPLY_ENTRY_FACTORIES,
  applyEntryFactories,
  buildExecutionSource,
  buildFigmaToolArguments,
  buildReadonlyTransportSource,
} from "./execution-source.mjs";
import * as prepare from "./prepare.mjs";
import { createRuntime } from "./runtime.mjs";
import {
  BRAND_FILE,
  CONSUMER_FILE,
  contract,
  core,
  createFakeFigma,
  createScenario,
  createWorld,
  executeSource,
  fixed,
  makeRequest,
  scan,
} from "./test-support.mjs";
import { createNodeTransport } from "./transport-codec.mjs";

const transport = createNodeTransport();
/**
 * apply 的生成碼目前超過工具的 50,000 字元上限(見下方「上限」各測試),正式入口會拒絕。
 * 這裡明示放寬字元上限,讓生成 / minify / codec 後的 apply 仍在 fake Figma 真執行並與直接 factories 比對。
 */
const LIFTED = { codeChars: Number.MAX_SAFE_INTEGER };
const EXECUTOR_ONLY =
  /setBoundVariableForPaint|setEffectStyleIdAsync|setValueForMode|createVariableCollection|createEffectStyle/;
/**
 * generatedAt 是執行當下的時間;兩個獨立世界各自掃描,plan 的 digest 也因此不同。
 * 比對前統一這兩項,其餘內容(寫入結果、readBack、完整 afterInventory)必須逐欄相同。
 */
const settle = (artifact) => {
  const copy = structuredClone(artifact);
  copy.generatedAt = "T";
  if (copy.planDigest) copy.planDigest = "P";
  if (copy.afterInventory) copy.afterInventory.generatedAt = "T";
  return copy;
};
const code = (expected) => (error) => {
  assert.equal(error.code, expected, error.message);
  return true;
};
const scanRequest = (runId) =>
  makeRequest({
    targetKind: "consumer",
    fileKey: CONSUMER_FILE,
    roots: ["10:1"],
    runId,
  });
/** 執行首次生成碼,再依 head 逐塊執行唯讀生成碼,組回原協定 artifact。 */
async function runGenerated(world, fileKey, request, plan) {
  const figma = () => createFakeFigma(world, fileKey);
  const head = await executeSource(
    buildExecutionSource({ request, plan, limits: plan ? LIFTED : undefined }),
    figma(),
  );
  const chunks = [];
  const count = head.payload ? head.payload.chunkCount : 0;
  for (let index = 0; index < count; index += 1) {
    const source = buildReadonlyTransportSource({ request, head, index });
    chunks.push(await executeSource(source, figma()));
  }
  return { head, artifact: transport.assemble(request, head, chunks) };
}
function addNoise(scenario, count) {
  for (let index = 0; index < count; index += 1) {
    scenario.consumer.root.append(
      scenario.world.node(CONSUMER_FILE, {
        id: `50:${index}`,
        type: "TEXT",
        characters: `${randomBytes(1500).toString("base64")} 中文 \u{1F600}`,
        fills: [fixed()],
        fontName: { family: "Public Sans", style: "Regular" },
      }),
    );
  }
}

test("生成碼:同一份受測函式整體轉成 ES2017 並 minify,ASCII、在工具參數上限內、保留 MIT notice", () => {
  const request = scanRequest("gen-1");
  const source = buildExecutionSource({ request, plan: null });
  assert.equal(buildExecutionSource({ request, plan: null }), source);
  assert.ok(source.startsWith("/*! fflate 0.8.3"));
  assert.ok(source.includes("MIT License"));
  assert.ok(source.trimEnd().endsWith("return await __figmaSyncEntry(figma);"));
  assert.ok(/^[\x09\x0a\x20-\x7e]*$/.test(source), "生成碼必須是 ASCII");
  assert.ok(Buffer.byteLength(source, "utf8") <= MAX_TOOL_ARGUMENT_BYTES);
  assert.equal(MAX_TOOL_ARGUMENT_BYTES, 128 * 1024);
  // 受驗 JSON 只以字串常值嵌入;沒有 import / require / eval,也沒有 ES2017 之後的語法
  assert.ok(source.includes("JSON.parse("));
  assert.ok(!/\b(import|require|eval)\s*\(/.test(source));
  assert.ok(
    !/\?\.[A-Za-z_(\[]|\?\?/.test(source.replace(/"(?:[^"\\]|\\.)*"/g, '""')),
  );
  // property 名稱沒有被 mangle:Plugin API 與協定欄位名都原樣存在
  for (const name of [
    "getMainComponentAsync",
    "boundVariables",
    "rootNodeIds",
  ]) {
    assert.ok(source.includes(name), name);
  }
});

test("只組該 operation 必需的 factories:scan 與唯讀分塊入口沒有 executor,apply 才有", async () => {
  assert.equal(SCAN_ENTRY_FACTORIES.createPlanExecutor, undefined);
  assert.equal(SCAN_ENTRY_FACTORIES.createRecoveryCore, undefined);
  assert.equal(SCAN_ENTRY_FACTORIES.createConsumerPlanner, undefined);
  assert.equal(APPLY_ENTRY_FACTORIES.createSyncVerifier, undefined);
  const scenario = await createScenario();
  const planned = await scenario.sync("gen-2", { planOnly: true });
  const request = {
    ...planned.input.request,
    inputDigests: {
      ...planned.input.request.inputDigests,
      plan: contract.digest(planned.plan),
    },
  };
  const scanSource = buildExecutionSource({
    request: scanRequest("gen-2s"),
    plan: null,
  });
  const applySource = buildExecutionSource({
    request,
    plan: planned.plan,
    limits: LIFTED,
  });
  assert.ok(!EXECUTOR_ONLY.test(scanSource));
  assert.ok(EXECUTOR_ONLY.test(applySource));
  assert.ok(Buffer.byteLength(applySource, "utf8") <= MAX_TOOL_ARGUMENT_BYTES);
  // apply 的後續取塊入口同樣不含 executor,也不帶 plan
  const head = await executeSource(
    applySource,
    createFakeFigma(scenario.world, CONSUMER_FILE),
  );
  const readSource = buildReadonlyTransportSource({ request, head, index: 0 });
  assert.ok(!EXECUTOR_ONLY.test(readSource));
  assert.ok(readSource.length < applySource.length);
});

test("各 factory 可獨立序列化:只靠參數與函式內部,脫離 module 仍能組裝", () => {
  const rebuilt = {};
  for (const [name, factory] of Object.entries(CORE_FACTORIES)) {
    rebuilt[name] = new Function(`return (${factory.toString()});`)();
  }
  const isolated = assembleCore(rebuilt);
  const value = { b: [1, "中文"], a: null };
  assert.equal(isolated.contract.digest(value), contract.digest(value));
  assert.deepEqual(Object.keys(isolated.core), Object.keys(core));
  // 要送進 Figma 的函式不 import、不碰 Node API;core 的 factories 完全不提 figma
  for (const [name, factory] of Object.entries(APPLY_ENTRY_FACTORIES)) {
    const text = factory.toString();
    assert.ok(!/\b(process|Buffer|require)\b|node:/.test(text), name);
  }
  for (const [name, factory] of Object.entries(CORE_FACTORIES)) {
    assert.ok(!/\bfigma\b/.test(factory.toString()), name);
  }
});

test("scan:生成 / minify / codec 之後在 fake Figma 真執行,多塊組回的結果與直接 factories 相等", async () => {
  const scenario = await createScenario();
  addNoise(scenario, 30);
  const request = scanRequest("gen-3");
  const { head, artifact } = await runGenerated(
    scenario.world,
    CONSUMER_FILE,
    request,
    null,
  );
  assert.ok(head.payload.chunkCount >= 3);
  assert.ok(Buffer.byteLength(JSON.stringify(head), "utf8") <= 18000);
  const direct = await createRuntime(
    createFakeFigma(scenario.world, CONSUMER_FILE),
  ).scanScope(request);
  assert.deepEqual(settle(artifact), settle(direct));
  assert.equal(scenario.world.mutations.length, 0);
});

test("apply(consumer):生成碼與直接 factories 在兩個相同世界得到相同 attempt 與相同寫入序列", async () => {
  const run = async (execute) => {
    const scenario = await createScenario();
    const planned = await scenario.sync("gen-4", { planOnly: true });
    const request = {
      ...planned.input.request,
      inputDigests: {
        ...planned.input.request.inputDigests,
        plan: contract.digest(planned.plan),
      },
    };
    scenario.world.resetLog();
    const attempt = await execute(scenario.world, request, planned.plan);
    return { attempt, mutations: scenario.world.mutations };
  };
  const generated = await run(
    async (world, request, plan) =>
      (await runGenerated(world, CONSUMER_FILE, request, plan)).artifact,
  );
  const direct = await run((world, request, plan) =>
    createRuntime(createFakeFigma(world, CONSUMER_FILE)).applyPlan(
      request,
      plan,
    ),
  );
  assert.equal(generated.attempt.status, "applied");
  assert.equal(generated.attempt.completedActions.length, 15);
  assert.deepEqual(settle(generated.attempt), settle(direct.attempt));
  // 寫入序列也相同:生成碼不是只回傳看起來正確的 JSON;取塊的執行沒有多寫
  assert.deepEqual(generated.mutations, direct.mutations);
  assert.equal(
    generated.mutations.filter((entry) => entry.type === "scene").length,
    15,
  );
});

test("apply(品牌庫初建):生成碼真的建立資產,回傳交給 Node 端同一份 core 驗證得到 receipt", async () => {
  const world = createWorld();
  world.addFile(BRAND_FILE, ["Brand"]);
  const brand = await scan(
    world,
    "brand-library",
    BRAND_FILE,
    [`P${BRAND_FILE}:0`],
    "gen-5-scan",
  );
  const base = makeRequest({
    operation: "apply",
    targetKind: "brand-library",
    fileKey: BRAND_FILE,
    roots: brand.scope.rootNodeIds,
    runId: "gen-5",
    inputDigests: { inventories: [contract.digest(brand)] },
  });
  const plan = core.planSync({ request: base, inventories: { brand } });
  const request = {
    ...base,
    inputDigests: { ...base.inputDigests, plan: contract.digest(plan) },
  };
  const { head, artifact } = await runGenerated(
    world,
    BRAND_FILE,
    request,
    plan,
  );
  assert.equal(head.attemptHead.completedActions.length, 28);
  assert.equal(
    Array.from(world.variables.values()).filter(
      (variable) => variable.fileKey === BRAND_FILE,
    ).length,
    12,
  );
  const verdict = core.verifySync({
    plan,
    beforeInventory: brand,
    afterInventory: artifact.afterInventory,
    previousReceipt: null,
    attempt: artifact,
  });
  assert.equal(verdict.status, "verified");
  assert.equal(verdict.receipt.changes.createdAssets, 15);
});

test("生成前先驗:request / plan 必須是協定內容且互相對應;唯讀入口的 index 要在範圍內", async () => {
  const scenario = await createScenario();
  const planned = await scenario.sync("gen-6", { planOnly: true });
  const request = scanRequest("gen-6");
  const applyRequest = {
    ...planned.input.request,
    inputDigests: {
      ...planned.input.request.inputDigests,
      plan: contract.digest(planned.plan),
    },
  };
  assert.throws(
    () => buildExecutionSource({ request: planned.plan, plan: null }),
    code("ARTIFACT_KIND_MISMATCH"),
  );
  assert.throws(
    () => buildExecutionSource({ request, plan: planned.plan }),
    code("REQUEST_OPERATION_INVALID"),
  );
  assert.throws(
    () => buildExecutionSource({ request: applyRequest, plan: null }),
    code("REQUEST_OPERATION_INVALID"),
  );
  // plan 在 request 記下 digest 之後被改過
  const edited = structuredClone(planned.plan);
  edited.generatedAt = "2031-01-01T00:00:00Z";
  assert.throws(
    () => buildExecutionSource({ request: applyRequest, plan: edited }),
    code("PLAN_CHANGED"),
  );
  assert.throws(
    () =>
      buildExecutionSource({ request: { ...request, extra: 1 }, plan: null }),
    code("ARTIFACT_INVALID"),
  );
  const head = await executeSource(
    buildExecutionSource({ request, plan: null }),
    createFakeFigma(scenario.world, CONSUMER_FILE),
  );
  for (const index of [-1, head.payload.chunkCount, 1.5]) {
    assert.throws(
      () => buildReadonlyTransportSource({ request, head, index }),
      code("TRANSPORT_INDEX_INVALID"),
    );
  }
  assert.throws(
    () =>
      buildReadonlyTransportSource({
        request: { ...request, runId: "other" },
        head,
        index: 0,
      }),
    code("TRANSPORT_ENVELOPE_INVALID"),
  );
});

test("buildFigmaToolArguments:固定四欄位;code 字元數與完整 arguments JSON 的 UTF-8 bytes 各自驗證", () => {
  const source = buildExecutionSource({
    request: scanRequest("args-1"),
    plan: null,
  });
  const args = buildFigmaToolArguments({ fileKey: CONSUMER_FILE, source });
  assert.deepEqual(args, {
    fileKey: CONSUMER_FILE,
    code: source,
    description: "Execute verified Figma sync request",
    skillNames: "figma-use,figma-generate-library",
  });
  assert.equal(prepare.buildFigmaToolArguments, buildFigmaToolArguments);
  assert.equal(MAX_TOOL_CODE_CHARS, 50000);
  assert.equal(MAX_TOOL_ARGUMENT_BYTES, 128 * 1024);
  // 實際 arguments JSON 比 source 大:code 的引號 / 換行 / 反斜線 escaping 與其他三個欄位都算
  const bytesOf = (value) => Buffer.byteLength(JSON.stringify(value), "utf8");
  assert.ok(bytesOf(args) > Buffer.byteLength(source, "utf8") + 100);
  const tooLarge = (error) => {
    assert.equal(error.name, "FigmaSyncError");
    assert.equal(error.code, "EXECUTION_SOURCE_TOO_LARGE");
    return true;
  };
  const build = (code, fileKey = "F") =>
    buildFigmaToolArguments({ fileKey, source: code });

  // 字元上限:恰好 50,000 通過,多一個字元就拒絕(與 fileKey、bytes 無關)
  assert.equal(build("x".repeat(50000)).code.length, 50000);
  assert.throws(() => build("x".repeat(50001)), tooLarge);
  assert.throws(() => build(`${"x".repeat(50000)}\n`), tooLarge);
  // 以字元計,不是 UTF-8 bytes:16,667 個中文字(50,001 bytes)在兩個上限內
  assert.equal(build("中".repeat(16667)).code.length, 16667);
  // 真 Figma 拒絕過的大小(52,211 字元)與先前的生成碼大小都被擋下
  assert.throws(() => build("x".repeat(52211)), tooLarge);

  // bytes 上限另外驗:字元數在 50,000 內,但完整 arguments JSON 超過 128 KiB
  const wide = "中".repeat(45000);
  assert.ok(wide.length <= MAX_TOOL_CODE_CHARS);
  assert.ok(Buffer.byteLength(wide, "utf8") > MAX_TOOL_ARGUMENT_BYTES);
  assert.throws(() => build(wide), tooLarge);
  // 恰好卡在 bytes 上限:escaping、其他欄位與 fileKey 的長度都計入
  const overhead = bytesOf(build("x"));
  const exact = "中".repeat(43000);
  const room = MAX_TOOL_ARGUMENT_BYTES - (overhead - 1) - 43000 * 3;
  assert.ok(room > 0 && exact.length + room <= MAX_TOOL_CODE_CHARS);
  const padded = `${exact}${"x".repeat(room)}`;
  assert.equal(bytesOf(build(padded)), MAX_TOOL_ARGUMENT_BYTES);
  assert.throws(() => build(`${padded}x`), tooLarge);
  assert.throws(() => build(padded, "FF"), tooLarge);
  // 每個字元都要 escape 的內容:字元數在內,arguments bytes 加倍後超限
  const escaped = '"\n'.repeat(24000) + "中".repeat(1500);
  assert.ok(escaped.length <= MAX_TOOL_CODE_CHARS);
  assert.ok(Buffer.byteLength(escaped, "utf8") < MAX_TOOL_ARGUMENT_BYTES / 2);
  assert.ok(bytesOf({ code: escaped }) < MAX_TOOL_ARGUMENT_BYTES);
  assert.equal(build(escaped).code, escaped);

  assert.throws(
    () => buildFigmaToolArguments({ fileKey: "", source }),
    (error) => error.code === "FILE_KEY_INVALID",
  );
  assert.throws(
    () => buildFigmaToolArguments({ fileKey: "F", source: "" }),
    (error) => error.code === "EXECUTION_SOURCE_INVALID",
  );
});

/** 四個代表案例的生成碼(apply 以放寬的字元上限生成,才能量到實際大小)。 */
async function representativeSources() {
  const scenario = await createScenario();
  const request = scanRequest("size-scan");
  const scanSource = buildExecutionSource({ request, plan: null });
  const head = await executeSource(
    scanSource,
    createFakeFigma(scenario.world, CONSUMER_FILE),
  );
  const readSource = buildReadonlyTransportSource({ request, head, index: 0 });
  const planned = await scenario.sync("size-consumer", { planOnly: true });
  const consumer = {
    request: {
      ...planned.input.request,
      inputDigests: {
        ...planned.input.request.inputDigests,
        plan: contract.digest(planned.plan),
      },
    },
    plan: planned.plan,
    world: scenario.world,
  };
  const world = createWorld();
  world.addFile(BRAND_FILE, ["Brand"]);
  const inventory = await scan(
    world,
    "brand-library",
    BRAND_FILE,
    [`P${BRAND_FILE}:0`],
    "size-brand-scan",
  );
  const base = makeRequest({
    operation: "apply",
    targetKind: "brand-library",
    fileKey: BRAND_FILE,
    roots: inventory.scope.rootNodeIds,
    runId: "size-brand",
    inputDigests: { inventories: [contract.digest(inventory)] },
  });
  const plan = core.planSync({
    request: base,
    inventories: { brand: inventory },
  });
  const brand = {
    request: {
      ...base,
      inputDigests: { ...base.inputDigests, plan: contract.digest(plan) },
    },
    plan,
    world,
  };
  return { scanSource, readSource, consumer, brand };
}
const sizeOf = (fileKey, source) => ({
  chars: source.length,
  argumentBytes: Buffer.byteLength(
    JSON.stringify({
      fileKey,
      code: source,
      description: "Execute verified Figma sync request",
      skillNames: "figma-use,figma-generate-library",
    }),
    "utf8",
  ),
});

test("上限:scan 與唯讀分塊的生成碼在 50,000 字元與 128 KiB 內,且留有餘裕", async () => {
  const { scanSource, readSource } = await representativeSources();
  for (const source of [scanSource, readSource]) {
    const size = sizeOf(CONSUMER_FILE, source);
    assert.ok(size.chars <= 47000, `chars ${size.chars}`);
    assert.ok(size.argumentBytes <= 50000, `bytes ${size.argumentBytes}`);
    // generator 已用實際的工具參數驗過;實際 caller 再驗一次得到相同結果
    assert.equal(
      buildFigmaToolArguments({ fileKey: CONSUMER_FILE, source }).code,
      source,
    );
  }
  // scan / 唯讀入口不帶 plan / attempt 的 schema、相依圖、recovery 與任何 writer
  for (const name of [
    "createRecordSchema",
    "createPlanGraph",
    "createGuardValues",
    "createTraceBudget",
    "createRecoveryCore",
    "createPlanExecutor",
    "createSceneWriter",
    "createAssetWriter",
    "createEnvelopeRules",
    "createTransportReceiver",
    "createIdentityReviewer",
    "createReceiptSchema",
  ]) {
    assert.equal(SCAN_ENTRY_FACTORIES[name], undefined, name);
  }
  assert.ok(!/set-variable-value|PLAN_REF_ROLE|STALE_PLAN/.test(scanSource));
});

test("上限:apply 的生成碼目前仍超過 50,000 字元 → 生成階段明確拒絕,零 mutation、不產生可執行檔", async () => {
  const { consumer, brand } = await representativeSources();
  const tooLarge = (error) => {
    assert.equal(error.name, "FigmaSyncError");
    assert.equal(error.code, "EXECUTION_SOURCE_TOO_LARGE");
    return true;
  };
  for (const [name, run, fileKey, actions] of [
    ["consumer", consumer, CONSUMER_FILE, 15],
    ["brand-library", brand, BRAND_FILE, 28],
  ]) {
    assert.equal(run.plan.actions.length, actions, name);
    run.world.resetLog();
    // 正式入口(固定上限):不回傳任何 source,world 沒有任何寫入
    assert.throws(
      () => buildExecutionSource({ request: run.request, plan: run.plan }),
      tooLarge,
    );
    assert.equal(run.world.mutations.length, 0);
    // 實際大小:完整 arguments 仍在 128 KiB 內,超的是 code 的字元數
    const source = buildExecutionSource({
      request: run.request,
      plan: run.plan,
      limits: LIFTED,
    });
    const size = sizeOf(fileKey, source);
    assert.ok(size.chars > MAX_TOOL_CODE_CHARS, `${name} ${size.chars}`);
    assert.ok(size.chars < 66000, `${name} ${size.chars}`);
    assert.ok(size.argumentBytes <= MAX_TOOL_ARGUMENT_BYTES);
    // 實際 caller 用的 helper 一樣拒絕:超量的 code 送不進工具
    assert.throws(() => buildFigmaToolArguments({ fileKey, source }), tooLarge);
    // 放寬只影響字元上限:128 KiB 的完整 arguments 上限不能放寬掉
    assert.throws(
      () =>
        buildExecutionSource({
          request: run.request,
          plan: run.plan,
          limits: { codeChars: LIFTED.codeChars, argumentBytes: 1000 },
        }),
      tooLarge,
    );
  }
});

test("apply 入口依 targetKind 只組需要的 writer / 判定 / 相依圖規則;另一種 plan 在零 mutation 時被拒絕", async () => {
  assert.equal(applyEntryFactories("consumer"), SCENE_APPLY_ENTRY_FACTORIES);
  assert.equal(
    applyEntryFactories("brand-library"),
    ASSET_APPLY_ENTRY_FACTORIES,
  );
  for (const name of [
    "createAssetWriter",
    "createAssetClassifier",
    "createAssetGraphRules",
  ]) {
    assert.equal(SCENE_APPLY_ENTRY_FACTORIES[name], undefined, name);
    assert.equal(typeof ASSET_APPLY_ENTRY_FACTORIES[name], "function", name);
  }
  for (const name of ["createSceneWriter", "createSceneClassifier"]) {
    assert.equal(ASSET_APPLY_ENTRY_FACTORIES[name], undefined, name);
    assert.equal(typeof SCENE_APPLY_ENTRY_FACTORIES[name], "function", name);
  }
  assert.deepEqual(
    Object.keys(APPLY_ENTRY_FACTORIES).sort(),
    Array.from(
      new Set(
        Object.keys(SCENE_APPLY_ENTRY_FACTORIES).concat(
          Object.keys(ASSET_APPLY_ENTRY_FACTORIES),
        ),
      ),
    ).sort(),
  );
  const { consumer, brand } = await representativeSources();
  const consumerSource = buildExecutionSource({
    request: consumer.request,
    plan: consumer.plan,
    limits: LIFTED,
  });
  const brandSource = buildExecutionSource({
    request: brand.request,
    plan: brand.plan,
    limits: LIFTED,
  });
  // consumer 的生成碼沒有建立 / 寫入資產的 API;品牌庫的生成碼沒有場景寫入的 API
  assert.ok(
    !/createVariableCollection|createEffectStyle|setValueForMode/.test(
      consumerSource,
    ),
  );
  assert.ok(/setBoundVariableForPaint/.test(consumerSource));
  assert.ok(
    !/setBoundVariableForPaint|setEffectStyleIdAsync|loadFontAsync/.test(
      brandSource,
    ),
  );
  assert.ok(/createVariableCollection/.test(brandSource));
});
test("沒有 TextEncoder / TextDecoder / Buffer 的 runtime:生成碼照跑,含 emoji 的內容組回後完全相同", async () => {
  const scenario = await createScenario();
  addNoise(scenario, 12);
  const request = scanRequest("bare-1");
  // 與 Figma 相同:async 函式本體、全域只有 figma;此 context 沒有任何 Node / Web 的文字編碼 API
  const run = (source) =>
    vm
      .runInNewContext(
        `(async function (figma) {\n${source}\n})`,
        {},
      )(createFakeFigma(scenario.world, CONSUMER_FILE))
      .then((value) => JSON.parse(JSON.stringify(value)));
  assert.equal(
    vm.runInNewContext(
      "typeof TextEncoder + typeof TextDecoder + typeof Buffer",
      {},
    ),
    "undefinedundefinedundefined",
  );
  const head = await run(buildExecutionSource({ request, plan: null }));
  assert.equal(head.type, "head");
  const chunks = [];
  for (let index = 0; index < head.payload.chunkCount; index += 1) {
    chunks.push(
      await run(buildReadonlyTransportSource({ request, head, index })),
    );
  }
  const assembled = transport.assemble(request, head, chunks);
  assert.ok(JSON.stringify(assembled).includes("\u{1F600}"));
  const direct = await createRuntime(
    createFakeFigma(scenario.world, CONSUMER_FILE),
  ).scanScope(request);
  assert.deepEqual(settle(assembled), settle(direct));
});
