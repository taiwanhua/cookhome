import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import vm from "node:vm";
import { gunzipSync } from "node:zlib";

import { contract, createScenario } from "./test-support.mjs";
import {
  codecFingerprint,
  codecNotice,
  createCodecSource,
  createNodeCodec,
  createNodeTransport,
  encodeExecutionPayload,
} from "./transport-codec.mjs";

const source = createCodecSource();
const nodeCodec = createNodeCodec();
const TEXT = `{"名稱":"繁體中文 \u{1F600}","n":[1,2.5,null],"pad":"${"x".repeat(3000)}"}`;
const INPUT = Array.from(Buffer.from(TEXT, "utf8"));
/** 在沒有 TextEncoder / TextDecoder / Buffer / Worker / fetch 的環境執行嵌入的 codec。 */
const bare = (script) =>
  vm.runInNewContext(
    `const codec = ${source};\nconst input = new Uint8Array(${JSON.stringify(INPUT)});\n${script}`,
    {},
  );

test("嵌入的 codec 是固定版本 fflate 的同步 browser exports;同輸入內容固定", () => {
  assert.equal(createCodecSource(), source);
  assert.deepEqual(Object.keys(codecFingerprint()), [
    "fflate",
    "esbuild",
    "codecSource",
  ]);
  assert.equal(codecFingerprint().fflate, "0.8.3");
  assert.equal(codecFingerprint().esbuild, "0.28.2");
  assert.ok(/^[\x20-\x7e]*$/.test(source), "codec source 必須是 ASCII");
  for (const token of [
    "Worker",
    "fetch(",
    "CompressionStream",
    "Buffer",
    "require(",
  ]) {
    assert.ok(!source.includes(token), token);
  }
  assert.ok(source.length < 16 * 1024);
  // fflate 模組層對 TextEncoder / TextDecoder 只做 typeof 偵測,沒有時不會呼叫;UTF-8 一律走 transport-bytes
  assert.equal(bare("Object.keys(codec).join()"), "gzip,gunzip");
});

test("MIT notice 取自已安裝套件的 LICENSE,以保留註解放在生成碼開頭", () => {
  const notice = codecNotice();
  assert.ok(notice.startsWith("/*! fflate 0.8.3"));
  assert.ok(notice.includes("MIT License"));
  assert.ok(notice.includes("Permission is hereby granted"));
  assert.ok(notice.trimEnd().endsWith("*/"));
  assert.equal(notice.indexOf("*/"), notice.lastIndexOf("*/"));
});

test("沒有 TextEncoder / Buffer 的環境:gzip 的 bytes 與 Node 端相同,可互相解開", () => {
  const compressed = Buffer.from(bare("Array.from(codec.gzip(input))"));
  // 同版 fflate、level 6、mtime 0:Figma 端與 Node 端壓出來的 bytes 相同,後續重掃的區塊才比得起來
  assert.deepEqual(
    compressed,
    Buffer.from(nodeCodec.gzip(new Uint8Array(INPUT))),
  );
  assert.equal(gunzipSync(compressed).toString("utf8"), TEXT);
  // gzip header 沒有 mtime 與 filename
  assert.deepEqual([...compressed.subarray(3, 8)], [0, 0, 0, 0, 0]);
  // vm 內的陣列屬於另一個 realm,以 JSON 帶出來比對
  assert.deepEqual(
    JSON.parse(
      bare("JSON.stringify(Array.from(codec.gunzip(codec.gzip(input))))"),
    ),
    INPUT,
  );
  assert.equal(
    bare("typeof TextEncoder + typeof Buffer"),
    "undefinedundefined",
  );
});

test("Node 端解壓走 zlib 並限制輸出長度", () => {
  const raw = new Uint8Array(INPUT);
  const compressed = nodeCodec.gzip(raw);
  assert.deepEqual(nodeCodec.gunzip(compressed, raw.length), raw);
  assert.throws(() => nodeCodec.gunzip(compressed, raw.length - 1));
  assert.throws(() => nodeCodec.gunzip(randomBytes(64), 1024));
});

test("encodeExecutionPayload:整份壓縮、不刪欄位,解碼後 byteLength 與完整 SHA 都對得上", async () => {
  const scenario = await createScenario();
  const run = await scenario.sync("codec-1", { planOnly: true });
  const transport = createNodeTransport();
  for (const value of [run.input.request, run.plan]) {
    const payload = encodeExecutionPayload(value);
    assert.deepEqual(Object.keys(payload), [
      "base64",
      "uncompressedBytes",
      "canonicalDigest",
    ]);
    assert.equal(payload.canonicalDigest, contract.digest(value));
    assert.equal(
      payload.uncompressedBytes,
      Buffer.byteLength(contract.canonicalJson(value), "utf8"),
    );
    assert.deepEqual(transport.decodeInput(payload), value);
    assert.ok(/^[A-Za-z0-9+/=]+$/.test(payload.base64));
    // 輸入被改過(digest 對不上)就不執行
    assert.throws(() =>
      transport.decodeInput({
        ...payload,
        canonicalDigest: contract.digest("x"),
      }),
    );
  }
  // Figma 端同版 codec 解得開 Node 端壓的輸入
  const payload = encodeExecutionPayload(run.plan);
  const compressed = Array.from(Buffer.from(payload.base64, "base64"));
  const length = vm.runInNewContext(
    `(${source}).gunzip(new Uint8Array(${JSON.stringify(compressed)})).length`,
    {},
  );
  assert.equal(length, payload.uncompressedBytes);
});
