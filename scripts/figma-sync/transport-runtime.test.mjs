import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";

import {
  APPLY_ENTRY_FACTORIES,
  SCAN_ENTRY_FACTORIES,
  applyEntryFactories,
} from "./execution-source.mjs";
import { createRuntime } from "./runtime.mjs";
import {
  BRAND_FILE,
  CONSUMER_FILE,
  contract,
  core,
  createFakeFigma,
  createScenario,
  createWorld,
  fixed,
  instantiate,
  makeRequest,
  scan,
} from "./test-support.mjs";
import {
  createNodeCodec,
  createNodeTransport,
  encodeExecutionPayload,
} from "./transport-codec.mjs";
import { runTransportEntry } from "./transport-runtime.mjs";

const transport = createNodeTransport();
const codec = createNodeCodec();
const scanRequest = (runId, roots = ["10:1"]) =>
  makeRequest({ targetKind: "consumer", fileKey: CONSUMER_FILE, roots, runId });
/** 首次入口(scan 或 apply)。 */
const first = (world, fileKey, request, plan = null) =>
  runTransportEntry(
    createFakeFigma(world, fileKey),
    codec,
    {
      request: encodeExecutionPayload(request),
      plan: plan ? encodeExecutionPayload(plan) : null,
      read: null,
    },
    plan ? applyEntryFactories(request.targetKind) : SCAN_ENTRY_FACTORIES,
  );
const descriptorOf = (head) => ({
  artifactKind: head.artifactKind,
  artifactDigest: head.artifactDigest,
  payload: head.payload,
  headDigest: contract.digest(head),
});
/** 後續唯讀入口:只有 scan 的 factories,沒有 executor。 */
const read = (world, fileKey, request, head, index) =>
  runTransportEntry(
    createFakeFigma(world, fileKey),
    codec,
    {
      request: encodeExecutionPayload(request),
      plan: null,
      read: { head: descriptorOf(head), index },
    },
    SCAN_ENTRY_FACTORIES,
  );
async function collect(world, fileKey, request, head) {
  const chunks = [];
  for (let index = 0; index < head.payload.chunkCount; index += 1) {
    chunks.push(await read(world, fileKey, request, head, index));
  }
  return transport.assemble(request, head, chunks);
}
const settle = (artifact) => ({ ...artifact, generatedAt: "T" });
/** 加一批帶隨機文字的節點,讓 inventory 壓縮後超過一塊(或超過上限)。 */
function addNoise(scenario, count, bytes) {
  for (let index = 0; index < count; index += 1) {
    scenario.consumer.root.append(
      scenario.world.node(CONSUMER_FILE, {
        id: `50:${index}`,
        type: "TEXT",
        characters: randomBytes(bytes).toString("base64"),
        fills: [fixed()],
        fontName: { family: "Public Sans", style: "Regular" },
      }),
    );
  }
}
async function plannedApply(scenario, runId) {
  const planned = await scenario.sync(runId, { planOnly: true });
  const request = {
    ...planned.input.request,
    inputDigests: {
      ...planned.input.request.inputDigests,
      plan: contract.digest(planned.plan),
    },
  };
  scenario.world.resetLog();
  return { ...planned, request };
}

test("scan:head 與唯讀區塊組回的 inventory 等於直接 factories 的結果", async () => {
  const scenario = await createScenario();
  addNoise(scenario, 30, 1500);
  const request = scanRequest("tr-scan");
  const head = await first(scenario.world, CONSUMER_FILE, request);
  assert.equal(head.type, "head");
  assert.ok(head.payload.chunkCount >= 3);
  assert.ok(transport.envelopeBytes(head) <= 18000);
  const assembled = await collect(scenario.world, CONSUMER_FILE, request, head);
  const direct = await createRuntime(
    createFakeFigma(scenario.world, CONSUMER_FILE),
  ).scanScope(request);
  assert.deepEqual(settle(assembled), settle(direct));
  assert.equal(assembled.generatedAt, head.payload.generatedAt);
  assert.equal(scenario.world.mutations.length, 0);
});

test("兩塊之間檔案漂移:即使名稱、顏色都一樣也回 TRANSFER_SNAPSHOT_CHANGED", async () => {
  const scenario = await createScenario();
  addNoise(scenario, 30, 1500);
  const request = scanRequest("tr-drift");
  const head = await first(scenario.world, CONSUMER_FILE, request);
  const ok = await read(scenario.world, CONSUMER_FILE, request, head, 1);
  assert.equal(ok.type, "chunk");
  assert.equal(ok.index, 1);
  assert.notEqual(ok.observedAt, undefined);
  scenario.consumer.nodes.customButton.x = 31;
  const drifted = await read(scenario.world, CONSUMER_FILE, request, head, 2);
  assert.equal(drifted.type, "error");
  assert.equal(drifted.code, "TRANSFER_SNAPSHOT_CHANGED");
  // 改回原狀後同一塊可以重讀
  scenario.consumer.nodes.customButton.x = 0;
  const again = await read(scenario.world, CONSUMER_FILE, request, head, 2);
  assert.equal(again.type, "chunk");
});

test("apply 只執行一次:head 帶完整 trace,後續取 afterInventory 的入口零 mutation", async () => {
  const scenario = await createScenario();
  addNoise(scenario, 30, 1500);
  const { plan, request, inventory } = await plannedApply(scenario, "tr-apply");
  const head = await first(scenario.world, CONSUMER_FILE, request, plan);
  assert.equal(head.type, "head");
  assert.equal(head.artifactKind, "attempt");
  assert.equal(head.attemptHead.status, "applied");
  assert.equal(head.attemptHead.completedActions.length, 15);
  assert.equal(head.attemptHead.afterInventoryDigest, null);
  assert.equal(scenario.world.count("scene"), 15);
  const mutations = scenario.world.mutations.length;

  const attempt = await collect(scenario.world, CONSUMER_FILE, request, head);
  assert.equal(scenario.world.mutations.length, mutations);
  assert.equal(contract.digest(attempt), head.artifactDigest);
  assert.deepEqual(attempt.completedActions, head.attemptHead.completedActions);
  const verdict = core.verifySync({
    plan,
    beforeInventory: inventory,
    afterInventory: attempt.afterInventory,
    previousReceipt: null,
    attempt,
  });
  assert.equal(verdict.status, "verified");
});

test("唯讀入口沒有 executor:帶 plan 或想再執行都被拒絕", async () => {
  assert.equal(SCAN_ENTRY_FACTORIES.createPlanExecutor, undefined);
  assert.equal(SCAN_ENTRY_FACTORIES.createRecoveryCore, undefined);
  assert.equal(typeof APPLY_ENTRY_FACTORIES.createPlanExecutor, "function");
  const scenario = await createScenario();
  const { plan, request } = await plannedApply(scenario, "tr-guard");
  const figma = () => createFakeFigma(scenario.world, CONSUMER_FILE);
  const input = (extra) => ({
    request: encodeExecutionPayload(request),
    plan: null,
    read: null,
    ...extra,
  });
  // apply request 沒有 plan 也不是唯讀入口
  await assert.rejects(
    runTransportEntry(figma(), codec, input({}), SCAN_ENTRY_FACTORIES),
    /REQUEST_OPERATION_INVALID/,
  );
  // 唯讀入口夾帶 plan
  await assert.rejects(
    runTransportEntry(
      figma(),
      codec,
      input({
        plan: encodeExecutionPayload(plan),
        read: { head: {}, index: 0 },
      }),
      APPLY_ENTRY_FACTORIES,
    ),
    /PLAN_CHANGED/,
  );
  // 內嵌輸入被改過:解碼後的完整 SHA 對不上
  const tampered = encodeExecutionPayload(plan);
  tampered.canonicalDigest = contract.digest("other");
  await assert.rejects(
    runTransportEntry(
      figma(),
      codec,
      input({ plan: tampered }),
      APPLY_ENTRY_FACTORIES,
    ),
    /TRANSPORT_PAYLOAD_INVALID/,
  );
  // plan 與 request 記的 digest 不是同一份
  const other = structuredClone(plan);
  other.generatedAt = "2031-01-01T00:00:00Z";
  await assert.rejects(
    runTransportEntry(
      figma(),
      codec,
      input({ plan: encodeExecutionPayload(other) }),
      APPLY_ENTRY_FACTORIES,
    ),
    /PLAN_CHANGED/,
  );
  assert.equal(scenario.world.mutations.length, 0);
});

test("trace 預算超量:任何 mutation / import 之前回 TRANSPORT_TRACE_TOO_LARGE", async () => {
  const scenario = await createScenario();
  for (let index = 0; index < 20; index += 1) {
    scenario.consumer.root.append(
      instantiate(
        scenario.world,
        CONSUMER_FILE,
        scenario.base.components.button,
        `60:${index}`,
      ),
    );
  }
  const { plan, request } = await plannedApply(scenario, "tr-budget");
  assert.ok(plan.actions.length > 60);
  const envelope = await first(scenario.world, CONSUMER_FILE, request, plan);
  assert.equal(envelope.type, "error");
  assert.equal(envelope.code, "TRANSPORT_TRACE_TOO_LARGE");
  assert.equal(envelope.artifactKind, "attempt");
  assert.equal(scenario.world.mutations.length, 0);
});

test("afterInventory 超過傳輸上限:回真的 interrupted attempt,已取得的 trace 全部保留", async () => {
  const scenario = await createScenario();
  addNoise(scenario, 70, 6000);
  const { plan, request } = await plannedApply(scenario, "tr-over");
  const head = await first(scenario.world, CONSUMER_FILE, request, plan);
  assert.equal(head.type, "head");
  assert.equal(head.payload, null);
  assert.equal(head.chunk0, null);
  assert.equal(head.attemptHead.status, "interrupted");
  assert.equal(head.attemptHead.completedActions.length, 15);
  assert.deepEqual(
    head.attemptHead.errors.map((error) => error.code),
    ["AFTER_INVENTORY_TRANSPORT_FAILED"],
  );
  // mutation 確實已經發生;傳輸失敗不代表沒寫
  assert.equal(scenario.world.count("scene"), 15);
  const attempt = transport.assemble(request, head, []);
  assert.equal(attempt.afterInventory, null);
  assert.equal(contract.digest(attempt), head.artifactDigest);
  assert.ok(transport.envelopeBytes(head) <= 18000);
});

test("品牌庫初建:head 內的 readBack 是真 key / localId,28 筆都在一個有界 envelope 內", async () => {
  const world = createWorld();
  world.addFile(BRAND_FILE, ["Brand"]);
  const brand = await scan(
    world,
    "brand-library",
    BRAND_FILE,
    [`P${BRAND_FILE}:0`],
    "tr-brand-scan",
  );
  const base = makeRequest({
    operation: "apply",
    targetKind: "brand-library",
    fileKey: BRAND_FILE,
    roots: brand.scope.rootNodeIds,
    runId: "tr-brand",
    inputDigests: { inventories: [contract.digest(brand)] },
  });
  const plan = core.planSync({ request: base, inventories: { brand } });
  const request = {
    ...base,
    inputDigests: { ...base.inputDigests, plan: contract.digest(plan) },
  };
  const head = await first(world, BRAND_FILE, request, plan);
  assert.equal(head.attemptHead.completedActions.length, 28);
  assert.ok(transport.envelopeBytes(head) <= 18000);
  const created = head.attemptHead.completedActions[0].readBack;
  const collection = Array.from(world.collections.values()).find(
    (item) => item.fileKey === BRAND_FILE && item.name === "Brand",
  );
  assert.deepEqual(created, {
    kind: "collection",
    key: collection.key,
    localId: collection.id,
    defaultModeId: collection.defaultModeId,
  });
  const attempt = await collect(world, BRAND_FILE, request, head);
  const verdict = core.verifySync({
    plan,
    beforeInventory: brand,
    afterInventory: attempt.afterInventory,
    previousReceipt: null,
    attempt,
  });
  assert.equal(verdict.status, "verified");
  assert.equal(verdict.receipt.changes.createdAssets, 15);
});
