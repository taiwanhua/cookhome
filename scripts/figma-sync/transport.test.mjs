import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { gzipSync } from "node:zlib";

import { contract, createScenario, makeRequest } from "./test-support.mjs";
import { createNodeTransport } from "./transport-codec.mjs";

const transport = createNodeTransport();
const code = (expected) => (error) => {
  assert.equal(error.name, "FigmaSyncError");
  assert.ok(error.message.startsWith(expected), error.message);
  return true;
};
const scenario = await createScenario();
const done = await scenario.sync("tr-1");
const inventory = done.inventory;
const scanRequest = makeRequest({
  targetKind: "consumer",
  fileKey: inventory.observedFileKey,
  roots: inventory.scope.rootNodeIds,
  runId: inventory.runId,
});

/** 把一份真 inventory 的節點與 slot 複製多份(仍是合法 artifact),用來產生較大的 payload。 */
function inflate(source, copies, noise = () => "") {
  const copy = structuredClone(source);
  for (let i = 0; i < copies; i += 1) {
    for (const node of source.nodes) {
      const clone = structuredClone(node);
      clone.nodeId = `${node.nodeId}~${i}`;
      clone.protectedSnapshot.characters = noise(i);
      copy.nodes.push(clone);
    }
    for (const slot of source.slots) {
      const clone = structuredClone(slot);
      clone.locator.nodeId = `${slot.locator.nodeId}~${i}`;
      copy.slots.push(clone);
    }
  }
  return copy;
}
const chunksOf = (head, value) => {
  const descriptor = {
    artifactKind: head.artifactKind,
    artifactDigest: head.artifactDigest,
    payload: head.payload,
    headDigest: contract.digest(head),
  };
  return Array.from({ length: head.payload.chunkCount }, (_, index) =>
    transport.buildChunk(scanRequest, descriptor, index, value),
  );
};

test("base64:與 Node 的編碼逐 byte 相同,任意長度可往返;非法輸入拒絕", () => {
  for (const length of [0, 1, 2, 3, 4, 5, 255, 256, 257, 4099]) {
    const bytes = new Uint8Array(randomBytes(length));
    const text = transport.toBase64(bytes);
    assert.equal(text, Buffer.from(bytes).toString("base64"));
    assert.deepEqual(transport.fromBase64(text), bytes);
  }
  for (const text of ["abc", "ab=c", "a b=", "===="]) {
    assert.throws(
      () => transport.fromBase64(text),
      code("TRANSPORT_PAYLOAD_INVALID"),
    );
  }
});

test("payload 往返:>20KB、數 MB、中文與 emoji 都無損,digest 是原 canonical SHA", () => {
  // 約 7MB、2,700 個節點:壓縮後 21 塊,在 32 塊上限內
  const big = inflate(
    inventory,
    100,
    (i) => `節點 ${i} 文案 \u{1F600}\u{1F9E1}`,
  );
  const bytes = Buffer.byteLength(contract.canonicalJson(big), "utf8");
  assert.ok(bytes > 4 * 1024 * 1024, String(bytes));
  for (const value of [
    inventory,
    big,
    { text: "繁體中文 \u{1F600}", list: [1.5, null] },
  ]) {
    const encoded = transport.encodePayload(value);
    assert.equal(encoded.canonicalDigest, contract.digest(value));
    assert.equal(
      encoded.uncompressedBytes,
      Buffer.byteLength(contract.canonicalJson(value), "utf8"),
    );
    assert.ok(
      encoded.chunks.slice(0, -1).every((chunk) => chunk.length === 12288),
    );
    assert.ok(encoded.chunks.at(-1).length <= 12288);
    assert.equal(encoded.chunks.join("").length, encoded.base64Length);
    const decoded = transport.decodePayload(encoded.chunks.join(""), encoded);
    assert.deepEqual(decoded, value);
  }
  assert.ok(Buffer.byteLength(contract.canonicalJson(inventory)) > 20000);
  assert.ok(transport.encodePayload(big).chunks.length > 1);
});

test("超過上限明確失敗:單件 16 MiB、32 塊;不裁切、不默默改走更多次", () => {
  // 幾乎不可壓縮的 1MB:壓縮後遠超過 32 × 12,288 個 base64 字元
  const noisy = { blob: randomBytes(600 * 1024).toString("base64") };
  assert.throws(
    () => transport.encodePayload(noisy),
    code("TRANSPORT_PAYLOAD_TOO_LARGE"),
  );
  const huge = { blob: "x".repeat(16 * 1024 * 1024 + 1) };
  assert.throws(
    () => transport.encodePayload(huge),
    code("TRANSPORT_PAYLOAD_TOO_LARGE"),
  );
  assert.deepEqual(transport.LIMITS, {
    envelopeBytes: 18000,
    chunkChars: 12288,
    payloadBytes: 16 * 1024 * 1024,
    chunks: 32,
  });
  assert.deepEqual(transport.CODEC, {
    name: "gzip-base64",
    implementation: "fflate",
    version: "0.8.3",
    level: 6,
    mtime: 0,
  });
});

test("損壞的 gzip、長度不符、超過解壓上限或 digest 不符都拒絕", () => {
  const encoded = transport.encodePayload(inventory);
  const base64 = encoded.chunks.join("");
  const invalid = code("TRANSPORT_PAYLOAD_INVALID");
  // 改掉中段的資料
  const middle = Math.floor(base64.length / 2);
  const flipped =
    base64.slice(0, middle) +
    (base64[middle] === "A" ? "B" : "A") +
    base64.slice(middle + 1);
  assert.throws(() => transport.decodePayload(flipped, encoded), invalid);
  assert.throws(
    () => transport.decodePayload(base64.slice(0, -8), encoded),
    invalid,
  );
  assert.throws(
    () =>
      transport.decodePayload(base64, {
        ...encoded,
        uncompressedBytes: encoded.uncompressedBytes - 1,
      }),
    invalid,
  );
  assert.throws(
    () =>
      transport.decodePayload(base64, {
        ...encoded,
        canonicalDigest: contract.digest("other"),
      }),
    invalid,
  );
  // 解壓炸彈:實際內容 2MB,尾端宣告的長度卻只寫 100 → 受 maxOutputLength 限制而失敗
  const bomb = gzipSync(Buffer.alloc(2 * 1024 * 1024));
  bomb.writeUInt32LE(100, bomb.length - 4);
  assert.throws(
    () =>
      transport.decodePayload(bomb.toString("base64"), {
        uncompressedBytes: 100,
        canonicalDigest: encoded.canonicalDigest,
      }),
    invalid,
  );
  // 宣告超過 16 MiB 的 payload 在解壓前就拒絕
  const oversized = gzipSync(Buffer.from("{}"));
  oversized.writeUInt32LE(17 * 1024 * 1024, oversized.length - 4);
  assert.throws(
    () =>
      transport.decodePayload(oversized.toString("base64"), {
        uncompressedBytes: 17 * 1024 * 1024,
        canonicalDigest: encoded.canonicalDigest,
      }),
    invalid,
  );
});

test("scan 的 head:共用欄位、payload 描述與第一塊;每個 envelope 都在 18,000 bytes 內", () => {
  const head = transport.buildHead(scanRequest, inventory);
  assert.deepEqual(Object.keys(head), [
    "transportVersion",
    "type",
    "runId",
    "requestDigest",
    "operation",
    "targetFileKey",
    "observedFileKey",
    "artifactKind",
    "artifactDigest",
    "codec",
    "payload",
    "attemptHead",
    "chunk0",
  ]);
  assert.equal(head.type, "head");
  assert.equal(head.requestDigest, contract.digest(scanRequest));
  assert.equal(head.artifactKind, "inventory");
  assert.equal(head.artifactDigest, contract.digest(inventory));
  assert.equal(head.attemptHead, null);
  assert.equal(head.payload.subject, "inventory");
  assert.equal(head.payload.generatedAt, inventory.generatedAt);
  assert.equal(head.payload.chunkSize, 12288);
  assert.equal(head.chunk0.index, 0);
  assert.ok(transport.envelopeBytes(head) <= 18000);
  assert.deepEqual(
    transport.assemble(scanRequest, head, chunksOf(head, inventory)),
    inventory,
  );
});

test("多塊:除最後一塊外長度固定,接齊後組回與原 artifact 完全相同", () => {
  const big = inflate(
    inventory,
    60,
    (i) => randomBytes(96).toString("base64") + i,
  );
  const head = transport.buildHead(scanRequest, big);
  const chunks = chunksOf(head, big);
  assert.ok(head.payload.chunkCount >= 3, String(head.payload.chunkCount));
  for (const chunk of chunks) {
    assert.ok(transport.envelopeBytes(chunk) <= 18000);
    assert.equal(chunk.headDigest, contract.digest(head));
    assert.equal(chunk.artifactDigest, head.artifactDigest);
  }
  assert.deepEqual(chunks[0].payloadBase64, head.chunk0.payloadBase64);
  const assembled = transport.assemble(scanRequest, head, chunks);
  assert.equal(contract.digest(assembled), contract.digest(big));

  const incomplete = code("TRANSPORT_CHUNKS_INCOMPLETE");
  assert.throws(
    () => transport.assemble(scanRequest, head, chunks.slice(1)),
    incomplete,
  );
  const invalid = code("TRANSPORT_CHUNK_INVALID");
  // 順序錯、內容被改、來自另一個 head 的區塊
  assert.throws(
    () =>
      transport.assemble(scanRequest, head, [
        chunks[1],
        chunks[0],
        ...chunks.slice(2),
      ]),
    invalid,
  );
  const altered = structuredClone(chunks);
  const prefix = chunks[1].payloadBase64[0] === "B" ? "A" : "B";
  const changedPayload = `${prefix}${chunks[1].payloadBase64.slice(1)}`;
  assert.notEqual(changedPayload, chunks[1].payloadBase64);
  altered[1].payloadBase64 = changedPayload;
  // 內容與自己的 chunkDigest 不符:在 envelope 驗證就被拒絕
  assert.throws(
    () => transport.assemble(scanRequest, head, altered),
    code("TRANSPORT_ENVELOPE_INVALID"),
  );
  // digest 自洽但內容不是原 payload:組回時完整 SHA / gzip 對不上
  const consistent = structuredClone(chunks);
  consistent[1].payloadBase64 = changedPayload;
  consistent[1].chunkDigest = contract.digest({
    index: 1,
    payloadBase64: consistent[1].payloadBase64,
  });
  assert.throws(
    () => transport.assemble(scanRequest, head, consistent),
    code("TRANSPORT_PAYLOAD_INVALID"),
  );
  const foreign = structuredClone(chunks);
  foreign[1].headDigest = contract.digest("other-head");
  assert.throws(() => transport.assemble(scanRequest, head, foreign), invalid);
  // 別的 request / run 的包
  const otherRequest = { ...scanRequest, runId: "other-run" };
  assert.throws(
    () => transport.assemble(otherRequest, head, chunks),
    code("TRANSPORT_ENVELOPE_INVALID"),
  );
});

test("後續區塊:沿第一份 generatedAt,其餘內容完整相同才回;任何漂移回 TRANSFER_SNAPSHOT_CHANGED", () => {
  const head = transport.buildHead(scanRequest, inventory);
  const descriptor = {
    artifactKind: "inventory",
    artifactDigest: head.artifactDigest,
    payload: head.payload,
    headDigest: contract.digest(head),
  };
  // 重掃的時間不同、內容相同
  const rescanned = { ...inventory, generatedAt: "2031-02-03T04:05:06.000Z" };
  const chunk = transport.buildChunk(scanRequest, descriptor, 0, rescanned);
  assert.equal(chunk.type, "chunk");
  assert.equal(chunk.observedAt, rescanned.generatedAt);
  assert.equal(chunk.payloadBase64, head.chunk0.payloadBase64);
  // observedAt 不參與內容身分
  const first = transport.buildChunk(scanRequest, descriptor, 0, inventory);
  assert.notEqual(first.observedAt, chunk.observedAt);
  assert.equal(transport.chunkIdentity(first), transport.chunkIdentity(chunk));
  // 時間固定但實值漂移:同名、同色也不放行
  for (const drift of [
    (copy) => (copy.nodes[0].protectedSnapshot.visible = false),
    (copy) => (copy.slots[0].value = { kind: "missing" }),
    (copy) => (copy.coverage.hiddenNodes += 1),
    (copy) => copy.issues.push({ code: "X", detail: "" }),
  ]) {
    const copy = structuredClone(rescanned);
    drift(copy);
    const error = transport.buildChunk(scanRequest, descriptor, 0, copy);
    assert.equal(error.type, "error");
    assert.equal(error.code, "TRANSFER_SNAPSHOT_CHANGED");
    assert.equal(error.artifactDigest, null);
  }
});

test("apply 的 head:attemptHead 保留完整 trace;組回後驗完整 raw attempt digest", () => {
  const { attempt, applyRequest } = done;
  const head = transport.buildHead(applyRequest, attempt);
  assert.equal(head.artifactKind, "attempt");
  assert.equal(head.artifactDigest, contract.digest(attempt));
  assert.equal(head.payload.subject, "after-inventory");
  assert.equal(head.payload.generatedAt, attempt.afterInventory.generatedAt);
  const { afterInventory, ...rest } = attempt;
  assert.deepEqual(head.attemptHead, rest);
  assert.equal(head.attemptHead.afterInventoryDigest, null);
  assert.equal(head.attemptHead.completedActions.length, 15);
  assert.ok(transport.envelopeBytes(head) <= 18000);
  const descriptor = {
    artifactKind: "attempt",
    artifactDigest: head.artifactDigest,
    payload: head.payload,
    headDigest: contract.digest(head),
  };
  const chunks = Array.from({ length: head.payload.chunkCount }, (_, index) =>
    transport.buildChunk(applyRequest, descriptor, index, afterInventory),
  );
  assert.deepEqual(transport.assemble(applyRequest, head, chunks), attempt);
  // attemptHead 被改過(例如少一筆 readBack):完整 digest 對不上
  const edited = structuredClone(head);
  edited.attemptHead.completedActions.pop();
  const rechunked = chunks.map((chunk) => ({
    ...chunk,
    headDigest: contract.digest(edited),
  }));
  assert.throws(
    () => transport.assemble(applyRequest, edited, rechunked),
    code("TRANSPORT_PAYLOAD_INVALID"),
  );
});

test("沒有 afterInventory 的失敗 attempt:head 不需要 gzip 也能保留 trace", () => {
  const { attempt, applyRequest } = done;
  const failed = {
    ...attempt,
    status: "failed",
    afterInventory: null,
    errors: [{ code: "FILE_KEY_UNREADABLE", detail: "" }],
    completedActions: [],
    observedFileKey: null,
  };
  const head = transport.buildHead(applyRequest, failed);
  assert.equal(head.payload, null);
  assert.equal(head.chunk0, null);
  assert.equal(head.observedFileKey, null);
  assert.deepEqual(transport.assemble(applyRequest, head, []), failed);
});

test("afterInventory 超量:改成真的 interrupted attempt 再定 digest,trace 與 readBack 全部保留", () => {
  const { attempt, applyRequest } = done;
  const oversized = {
    ...attempt,
    afterInventory: inflate(attempt.afterInventory, 80, () =>
      randomBytes(4096).toString("base64"),
    ),
  };
  const head = transport.buildHead(applyRequest, oversized);
  assert.equal(head.type, "head");
  assert.equal(head.payload, null);
  assert.equal(head.attemptHead.status, "interrupted");
  assert.deepEqual(head.attemptHead.completedActions, attempt.completedActions);
  assert.deepEqual(head.attemptHead.errors, [
    { code: "AFTER_INVENTORY_TRANSPORT_FAILED", detail: "" },
  ]);
  const final = transport.assemble(applyRequest, head, []);
  assert.equal(final.afterInventory, null);
  assert.equal(final.afterInventoryDigest, null);
  // digest 是這份最終 attempt 的,不是含 snapshot 的舊內容
  assert.equal(head.artifactDigest, contract.digest(final));
  assert.notEqual(head.artifactDigest, contract.digest(oversized));
  // scan 的 inventory 超量沒有 trace 可保留:直接回 error
  const scanError = transport.buildHead(
    scanRequest,
    inflate(inventory, 80, () => randomBytes(4096).toString("base64")),
  );
  assert.equal(scanError.type, "error");
  assert.equal(scanError.code, "INVENTORY_TRANSPORT_FAILED");
});

test("envelope 驗證:版本、type、request / run / file 與 bytes 上限", () => {
  const head = transport.buildHead(scanRequest, inventory);
  assert.equal(transport.checkEnvelope(scanRequest, head), head);
  const invalid = code("TRANSPORT_ENVELOPE_INVALID");
  for (const change of [
    { transportVersion: 2 },
    { type: "tail" },
    { runId: "other" },
    { requestDigest: contract.digest("other") },
    { operation: "apply" },
    { targetFileKey: "OTHERfile01" },
    { artifactKind: "attempt" },
    { padding: "x".repeat(18000) },
  ]) {
    assert.throws(
      () => transport.checkEnvelope(scanRequest, { ...head, ...change }),
      invalid,
    );
  }
  assert.throws(() => transport.checkEnvelope(scanRequest, [head]), invalid);
  assert.throws(() => transport.checkEnvelope(scanRequest, null), invalid);
});
