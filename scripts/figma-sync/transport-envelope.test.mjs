import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";

import {
  CONSUMER_FILE,
  contract,
  createScenario,
  fixed,
  makeRequest,
} from "./test-support.mjs";
import { createNodeTransport } from "./transport-codec.mjs";
import {
  createEnvelopeLimits,
  createEnvelopeRules,
} from "./transport-envelope.mjs";

const limits = createEnvelopeLimits(contract);
const rules = createEnvelopeRules(contract, limits);
const transport = createNodeTransport();
const invalid = (error) => {
  assert.equal(error.name, "FigmaSyncError");
  assert.equal(error.code, "TRANSPORT_ENVELOPE_INVALID", error.message);
  return true;
};
const clone = (value) => JSON.parse(JSON.stringify(value));

// 真 runtime 產生的多塊 scan 與一次 apply
const scenario = await createScenario();
for (let index = 0; index < 30; index += 1) {
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
const done = await scenario.sync("env-1");
const inventory = done.inventory;
const scanRequest = makeRequest({
  targetKind: "consumer",
  fileKey: CONSUMER_FILE,
  roots: inventory.scope.rootNodeIds,
  runId: inventory.runId,
});
const head = transport.buildHead(scanRequest, inventory);
const chunk = transport.buildChunk(
  scanRequest,
  {
    artifactKind: "inventory",
    artifactDigest: head.artifactDigest,
    payload: head.payload,
    headDigest: contract.digest(head),
  },
  1,
  inventory,
);
const attemptHead = transport.buildHead(done.applyRequest, done.attempt);
const rejects = (request, envelope, change) => {
  const copy = clone(envelope);
  change(copy);
  assert.throws(() => rules.checkEnvelope(request, copy), invalid);
};

test("固定預算與 codec 常數", () => {
  assert.deepEqual(rules.LIMITS, {
    envelopeBytes: 18000,
    chunkChars: 12288,
    payloadBytes: 16 * 1024 * 1024,
    chunks: 32,
  });
  assert.deepEqual(rules.CODEC, {
    name: "gzip-base64",
    implementation: "fflate",
    version: "0.8.3",
    level: 6,
    mtime: 0,
  });
  assert.equal(rules.checkEnvelope(scanRequest, head), head);
  assert.equal(rules.checkEnvelope(scanRequest, chunk), chunk);
  assert.equal(
    rules.checkEnvelope(done.applyRequest, attemptHead),
    attemptHead,
  );
  assert.ok(head.payload.chunkCount >= 3);
});

test("head:codec、payload 的 subject / digest / bytes / chunkCount(1..32)與 chunk0 都要完整合格", () => {
  for (const change of [
    (copy) => (copy.codec = { name: "invalid" }),
    (copy) => (copy.codec.version = "0.8.4"),
    (copy) => (copy.codec.extra = true),
    (copy) => (copy.payload.chunkCount = 33),
    (copy) => (copy.payload.chunkCount = 0),
    (copy) => (copy.payload.chunkCount = 1.5),
    (copy) => (copy.payload.chunkCount = "3"),
    (copy) => (copy.payload.chunkCount += 1),
    (copy) => (copy.payload.chunkCount = 1e9),
    (copy) => (copy.payload.chunkSize = 4096),
    (copy) => (copy.payload.subject = "after-inventory"),
    (copy) => (copy.payload.canonicalDigest = "abc"),
    (copy) => (copy.payload.generatedAt = "yesterday"),
    (copy) => (copy.payload.uncompressedBytes = 16 * 1024 * 1024 + 1),
    (copy) => (copy.payload.uncompressedBytes = -1),
    (copy) => (copy.payload.compressedBytes += 3),
    (copy) => (copy.payload.base64Length -= 4),
    (copy) => delete copy.payload.compressedBytes,
    (copy) => (copy.payload.extra = 1),
    (copy) => (copy.payload = null),
    (copy) => (copy.artifactDigest = null),
    (copy) => (copy.attemptHead = {}),
    (copy) => (copy.chunk0.index = 1),
    (copy) => (copy.chunk0.payloadBase64 = copy.chunk0.payloadBase64.slice(4)),
    (copy) => (copy.chunk0.chunkDigest = contract.digest("x")),
    (copy) =>
      (copy.chunk0.payloadBase64 = `*${copy.chunk0.payloadBase64.slice(1)}`),
    (copy) => (copy.observedFileKey = 7),
    (copy) => (copy.observedFileKey = ""),
    (copy) => delete copy.observedFileKey,
    (copy) => (copy.extra = true),
    (copy) => delete copy.chunk0,
  ]) {
    rejects(scanRequest, head, change);
  }
  // 沒有第一塊是合法的(由下一次唯讀取得)
  const withoutChunk = { ...head, chunk0: null };
  assert.equal(rules.checkEnvelope(scanRequest, withoutChunk), withoutChunk);
});

test("attempt 的 head:attemptHead 必須是這個 request 的 trace,且不能獨立冒充成功", () => {
  for (const change of [
    (copy) => (copy.attemptHead = null),
    (copy) => (copy.attemptHead.runId = "other-run"),
    (copy) => (copy.attemptHead.planDigest = contract.digest("other")),
    (copy) => (copy.attemptHead.afterInventory = {}),
    (copy) => (copy.attemptHead.afterInventoryDigest = contract.digest("x")),
    (copy) => (copy.attemptHead.kind = "inventory"),
    (copy) => (copy.attemptHead.status = "verified"),
    (copy) => (copy.attemptHead.completedActions = null),
    (copy) => (copy.attemptHead.observedFileKey = "OTHERfile01"),
    (copy) => (copy.payload.subject = "inventory"),
    // applied 卻沒有 afterInventory 的 payload
    (copy) => {
      copy.payload = null;
      copy.chunk0 = null;
    },
  ]) {
    rejects(done.applyRequest, attemptHead, change);
  }
  // 沒有 afterInventory 的失敗 attempt(含讀不到 fileKey)是合法的診斷 head
  const failed = transport.buildHead(done.applyRequest, {
    ...done.attempt,
    status: "failed",
    observedFileKey: null,
    completedActions: [],
    errors: [{ code: "FILE_KEY_UNREADABLE", detail: "" }],
    afterInventory: null,
  });
  assert.equal(failed.payload, null);
  assert.equal(failed.observedFileKey, null);
  assert.equal(rules.checkEnvelope(done.applyRequest, failed), failed);
});

test("chunk 與 error:固定欄位、index、base64、自洽的 chunkDigest、observedAt", () => {
  for (const change of [
    (copy) => (copy.index = -1),
    (copy) => (copy.index = 32),
    (copy) => (copy.index = "1"),
    (copy) => (copy.payloadBase64 = ""),
    (copy) => {
      const prefix = copy.payloadBase64[0] === "B" ? "A" : "B";
      const changed = `${prefix}${copy.payloadBase64.slice(1)}`;
      assert.notEqual(changed, copy.payloadBase64);
      copy.payloadBase64 = changed;
    },
    (copy) => (copy.payloadBase64 = `${copy.payloadBase64}AAAA`),
    (copy) => (copy.chunkDigest = contract.digest("x")),
    (copy) => (copy.headDigest = "x"),
    (copy) => (copy.artifactDigest = null),
    (copy) => delete copy.observedAt,
    (copy) => (copy.observedAt = 12345),
    (copy) => (copy.codec = head.codec),
    (copy) => (copy.type = "head"),
  ]) {
    rejects(scanRequest, chunk, change);
  }
  const error = transport.errorEnvelope(
    scanRequest,
    "inventory",
    "TRANSFER_SNAPSHOT_CHANGED",
    CONSUMER_FILE,
  );
  assert.equal(rules.checkEnvelope(scanRequest, error), error);
  for (const change of [
    (copy) => (copy.code = 7),
    (copy) => delete copy.code,
    (copy) => (copy.artifactDigest = contract.digest("x")),
    (copy) => (copy.payload = null),
  ]) {
    rejects(scanRequest, error, change);
  }
});

test("chunk 的內容身分含 observedFileKey、不含 observedAt", () => {
  const identity = rules.chunkIdentity(chunk);
  assert.equal(
    rules.chunkIdentity({ ...chunk, observedAt: "2031-01-01T00:00:00.000Z" }),
    identity,
  );
  for (const change of [
    { observedFileKey: "OTHERfile01" },
    { observedFileKey: null },
    { index: 2 },
    { headDigest: contract.digest("h") },
    { artifactDigest: contract.digest("a") },
    { runId: "other" },
    { payloadBase64: "AAAA" },
  ]) {
    assert.notEqual(rules.chunkIdentity({ ...chunk, ...change }), identity);
  }
  assert.equal(rules.chunkLength(head.payload, 0), 12288);
  assert.equal(
    rules.chunkLength(head.payload, head.payload.chunkCount - 1),
    head.payload.base64Length - 12288 * (head.payload.chunkCount - 1),
  );
});
