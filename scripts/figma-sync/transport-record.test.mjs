import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { SCAN_ENTRY_FACTORIES } from "./execution-source.mjs";
import {
  CONSUMER_FILE,
  contract,
  createFakeFigma,
  createScenario,
  executeSource,
  fixed,
  makeRequest,
} from "./test-support.mjs";
import { createNodeCodec, encodeExecutionPayload } from "./transport-codec.mjs";
import { recordTransport } from "./transport-record.mjs";
import { runTransportEntry } from "./transport-runtime.mjs";

const code = (expected) => (error) => {
  assert.equal(error.name, "FigmaSyncError");
  assert.ok(error.message.startsWith(expected), error.message);
  return true;
};
const codec = createNodeCodec();
const runDirOf = () =>
  mkdtempSync(path.join(tmpdir(), "figma-sync-transport-"));
const files = (runDir) =>
  existsSync(path.join(runDir, "transport/scan"))
    ? readdirSync(path.join(runDir, "transport/scan")).sort()
    : [];

/** 一個需要多塊才傳得完的 consumer 掃描。 */
async function setup(noise = 30) {
  const scenario = await createScenario();
  for (let index = 0; index < noise; index += 1) {
    scenario.consumer.root.append(
      scenario.world.node(CONSUMER_FILE, {
        id: `50:${index}`,
        type: "TEXT",
        characters: randomBytes(1500).toString("base64"),
        fills: [fixed()],
        fontName: { family: "Public Sans", style: "Regular" },
      }),
    );
  }
  const request = makeRequest({
    targetKind: "consumer",
    fileKey: CONSUMER_FILE,
    roots: ["10:1"],
    runId: "rec-run",
  });
  const entry = (read) =>
    runTransportEntry(
      createFakeFigma(scenario.world, CONSUMER_FILE),
      codec,
      { request: encodeExecutionPayload(request), plan: null, read },
      SCAN_ENTRY_FACTORIES,
    );
  const head = await entry(null);
  const descriptor = {
    artifactKind: head.artifactKind,
    artifactDigest: head.artifactDigest,
    payload: head.payload,
    headDigest: contract.digest(head),
  };
  const chunk = (index) => entry({ head: descriptor, index });
  return { scenario, request, head, chunk };
}

test("單一 envelope 就完整:head 附第一塊,直接組回原協定", async () => {
  const { request, head } = await setup(0);
  const runDir = runDirOf();
  assert.equal(head.payload.chunkCount, 1);
  const received = recordTransport({ request, envelope: head, runDir });
  assert.equal(received.complete, true);
  assert.equal(received.artifact.kind, "inventory");
  assert.equal(contract.digest(received.artifact), head.artifactDigest);
  assert.deepEqual(received.counts, { receivedChunks: 1, totalChunks: 1 });
  assert.deepEqual(files(runDir), ["chunk-000000.json", "head.json"]);
});

test("未接齊:先持久保存收到的包,回下一個缺失 index 的唯讀 JS;pending 不是成功", async () => {
  const { scenario, request, head, chunk } = await setup();
  const runDir = runDirOf();
  const total = head.payload.chunkCount;
  assert.ok(total >= 3);
  const pending = recordTransport({ request, envelope: head, runDir });
  assert.equal(pending.complete, false);
  assert.equal(pending.artifact, undefined);
  assert.deepEqual(pending.counts, { receivedChunks: 1, totalChunks: total });
  assert.deepEqual(
    pending.artifacts.map((item) => [item.kind, path.basename(item.path)]),
    [["execution-source", "read-000001.js"]],
  );
  assert.deepEqual(files(runDir), [
    "chunk-000000.json",
    "head.json",
    "read-000001.js",
  ]);
  // 生成的唯讀 JS 真的可在 fake Figma 執行,回的就是缺的那一塊;它沒有 executor
  const source = readFileSync(pending.artifacts[0].path, "utf8");
  assert.ok(
    !/setBoundVariableForPaint|setEffectStyleIdAsync|setValueForMode/.test(
      source,
    ),
  );
  const viaSource = await executeSource(
    source,
    createFakeFigma(scenario.world, CONSUMER_FILE),
  );
  assert.equal(viaSource.type, "chunk");
  assert.equal(viaSource.index, 1);
  assert.equal(scenario.world.mutations.length, 0);

  // 亂序送達也可以:先收最後一塊,仍指向最小的缺失 index
  const last = recordTransport({
    request,
    envelope: await chunk(total - 1),
    runDir,
  });
  assert.equal(last.complete, false);
  assert.equal(path.basename(last.artifacts[0].path), "read-000001.js");
  let received = recordTransport({ request, envelope: viaSource, runDir });
  for (let index = 2; index < total - 1; index += 1) {
    assert.equal(received.complete, false);
    assert.equal(
      path.basename(received.artifacts[0].path),
      `read-${String(index).padStart(6, "0")}.js`,
    );
    received = recordTransport({
      request,
      envelope: await chunk(index),
      runDir,
    });
  }
  assert.equal(received.complete, true);
  assert.equal(contract.digest(received.artifact), head.artifactDigest);
  assert.deepEqual(received.counts, {
    receivedChunks: total,
    totalChunks: total,
  });
});

test("相同區塊重送冪等並保留首包;observedAt 不參與比較;異內容拒絕", async () => {
  const { request, head, chunk } = await setup();
  const runDir = runDirOf();
  recordTransport({ request, envelope: head, runDir });
  const first = await chunk(1);
  recordTransport({ request, envelope: first, runDir });
  const stored = path.join(runDir, "transport/scan/chunk-000001.json");
  const bytes = readFileSync(stored);
  // 重讀時間不同、內容相同
  const resent = { ...first, observedAt: "2031-01-01T00:00:00.000Z" };
  const again = recordTransport({ request, envelope: resent, runDir });
  assert.equal(again.complete, false);
  assert.deepEqual(readFileSync(stored), bytes);
  assert.equal(JSON.parse(bytes).observedAt, first.observedAt);
  // 同 index 的不同內容(即使 chunkDigest 自洽)
  const differentPrefix = first.payloadBase64[0] === "B" ? "A" : "B";
  const payloadBase64 = `${differentPrefix}${first.payloadBase64.slice(1)}`;
  assert.notEqual(payloadBase64, first.payloadBase64);
  const different = {
    ...first,
    payloadBase64,
    chunkDigest: contract.digest({ index: 1, payloadBase64 }),
  };
  assert.throws(
    () => recordTransport({ request, envelope: different, runDir }),
    code("TRANSPORT_CHUNK_CHANGED"),
  );
  // 內容與自己的 digest 不符、index 超出協定範圍:envelope 本身不合協定
  for (const change of [{ payloadBase64 }, { index: 99 }, { index: 1.5 }]) {
    assert.throws(
      () =>
        recordTransport({ request, envelope: { ...first, ...change }, runDir }),
      code("TRANSPORT_ENVELOPE_INVALID"),
    );
  }
  // 形狀合法但不是這個 head 的區塊
  for (const change of [
    { headDigest: contract.digest("other") },
    { artifactDigest: contract.digest("other") },
  ]) {
    assert.throws(
      () =>
        recordTransport({ request, envelope: { ...first, ...change }, runDir }),
      code("TRANSPORT_CHUNK_INVALID"),
    );
  }
  assert.deepEqual(readFileSync(stored), bytes);
  // head 重送:相同冪等、不同拒絕
  recordTransport({ request, envelope: head, runDir });
  const otherHead = structuredClone(head);
  otherHead.payload.generatedAt = "2031-01-01T00:00:00.000Z";
  assert.throws(
    () => recordTransport({ request, envelope: otherHead, runDir }),
    code("TRANSPORT_HEAD_CHANGED"),
  );
});

test("head 遺失、錯的 request:不接受後續區塊,也不留下任何檔案", async () => {
  const { request, head, chunk } = await setup();
  const runDir = runDirOf();
  assert.throws(
    () => recordTransport({ request, envelope: chunk, runDir }),
    code("TRANSPORT_ENVELOPE_INVALID"),
  );
  const second = await chunk(1);
  assert.throws(
    () => recordTransport({ request, envelope: second, runDir }),
    code("TRANSPORT_HEAD_MISSING"),
  );
  const otherRequest = { ...request, runId: "another-run" };
  assert.throws(
    () => recordTransport({ request: otherRequest, envelope: head, runDir }),
    code("TRANSPORT_ENVELOPE_INVALID"),
  );
  const otherScope = {
    ...request,
    target: { ...request.target, rootNodeIds: ["10:2"] },
  };
  assert.throws(
    () => recordTransport({ request: otherScope, envelope: head, runDir }),
    code("TRANSPORT_ENVELOPE_INVALID"),
  );
  assert.deepEqual(files(runDir), []);
});

test("error envelope:先保存再失敗,序號由 CLI 產生;相同重送不另存", async () => {
  const { scenario, request, head, chunk } = await setup();
  const runDir = runDirOf();
  recordTransport({ request, envelope: head, runDir });
  scenario.consumer.nodes.customButton.x = 5;
  const drift = await chunk(1);
  assert.equal(drift.type, "error");
  assert.throws(
    () => recordTransport({ request, envelope: drift, runDir }),
    code("TRANSPORT_ERROR:TRANSFER_SNAPSHOT_CHANGED"),
  );
  assert.throws(
    () => recordTransport({ request, envelope: drift, runDir }),
    code("TRANSPORT_ERROR:TRANSFER_SNAPSHOT_CHANGED"),
  );
  assert.ok(files(runDir).includes("error-000000.json"));
  assert.ok(!files(runDir).includes("error-000001.json"));
  // 另一個錯誤另存一份;不可信的 code 不回印
  const other = { ...drift, code: "bad code\n::warning::x" };
  assert.throws(
    () => recordTransport({ request, envelope: other, runDir }),
    (error) => error.message === "TRANSPORT_ERROR",
  );
  assert.ok(files(runDir).includes("error-000001.json"));
  // 已收到的區塊不受影響
  assert.ok(files(runDir).includes("chunk-000000.json"));
});

test("畸形的 head 在任何保存、迴圈或生成下一支 JS 之前就被拒絕;之後合法的 head 仍可首次保存", async () => {
  const { request, head } = await setup();
  const runDir = runDirOf();
  for (const change of [
    (copy) => (copy.codec = { name: "invalid" }),
    (copy) => (copy.payload.chunkCount = 33),
    (copy) => (copy.payload.chunkCount = 1e9),
    (copy) => (copy.payload.subject = "after-inventory"),
    (copy) => (copy.payload.canonicalDigest = "x"),
    (copy) => (copy.attemptHead = { status: "applied" }),
    (copy) => (copy.observedFileKey = 42),
  ]) {
    const copy = JSON.parse(JSON.stringify(head));
    change(copy);
    assert.throws(
      () => recordTransport({ request, envelope: copy, runDir }),
      code("TRANSPORT_ENVELOPE_INVALID"),
    );
    // 沒有留下不可覆寫的 head、區塊或下一支 JS
    assert.deepEqual(files(runDir), []);
  }
  const pending = recordTransport({ request, envelope: head, runDir });
  assert.equal(pending.complete, false);
  assert.ok(files(runDir).includes("head.json"));
});

test("observedFileKey 不是目標檔:只封存為診斷,不進入後續成功流程", async () => {
  const { request, head, chunk } = await setup();
  const runDir = runDirOf();
  // 形狀完全合法、digest 自洽,但是在別的檔案觀測到的
  const wrongFile = { ...head, observedFileKey: "WRONGFILE" };
  const mismatch = code("TRANSPORT_FILE_KEY_MISMATCH");
  assert.throws(
    () => recordTransport({ request, envelope: wrongFile, runDir }),
    mismatch,
  );
  assert.throws(
    () =>
      recordTransport({
        request,
        envelope: { ...head, observedFileKey: null },
        runDir,
      }),
    mismatch,
  );
  assert.deepEqual(files(runDir), ["error-000000.json", "error-000001.json"]);
  // 診斷的封存不佔用 head.json:正確的 head 仍可首次保存並續傳
  recordTransport({ request, envelope: head, runDir });
  const second = await chunk(1);
  assert.throws(
    () =>
      recordTransport({
        request,
        envelope: { ...second, observedFileKey: "WRONGFILE" },
        runDir,
      }),
    mismatch,
  );
  assert.ok(!files(runDir).includes("chunk-000001.json"));
  const received = recordTransport({ request, envelope: second, runDir });
  assert.equal(received.counts.receivedChunks, 2);
  // observedFileKey 是 chunk 內容身分的一部分;observedAt 不是
  const transport = (
    await import("./transport-codec.mjs")
  ).createNodeTransport();
  assert.notEqual(
    transport.chunkIdentity({ ...second, observedFileKey: "WRONGFILE" }),
    transport.chunkIdentity(second),
  );
  assert.equal(
    transport.chunkIdentity({
      ...second,
      observedAt: "2031-01-01T00:00:00.000Z",
    }),
    transport.chunkIdentity(second),
  );
});
