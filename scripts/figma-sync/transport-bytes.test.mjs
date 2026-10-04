import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";

import { createContract } from "./core-contract.mjs";
import { createByteCodec } from "./transport-bytes.mjs";

const bytes = createByteCodec(createContract());
const code = (expected) => (error) => {
  assert.ok(error.message.startsWith(expected), error.message);
  return true;
};
const SAMPLES = [
  "",
  "ascii only",
  "é ñ ü",
  "繁體中文與標點、「引號」",
  // BMP 以外(surrogate pair):fflate 在沒有 TextEncoder 時會編錯的正是這一類
  "emoji \u{1F600}\u{1F9E1}\u{1F468}‍\u{1F469}‍\u{1F467}",
  "\u{10000}\u{10FFFF}",
  "x".repeat(20000) + "中".repeat(9000) + "\u{1F600}".repeat(5000),
];

test("UTF-8 編碼與 Node 的 Buffer 逐 byte 相同(含 emoji 與孤立 surrogate)", () => {
  for (const text of SAMPLES) {
    assert.deepEqual(
      Buffer.from(bytes.utf8Encode(text)),
      Buffer.from(text, "utf8"),
    );
  }
  // 孤立 surrogate 同 Node 編為 U+FFFD
  for (const text of ["\ud800", "a\udc00b", "\ud83d"]) {
    assert.deepEqual(
      Buffer.from(bytes.utf8Encode(text)),
      Buffer.from(text, "utf8"),
    );
  }
  assert.ok(bytes.utf8Encode("x") instanceof Uint8Array);
});

test("UTF-8 解碼與 Node 相同;不合法的序列直接失敗", () => {
  for (const text of SAMPLES) {
    assert.equal(
      bytes.utf8Decode(new Uint8Array(Buffer.from(text, "utf8"))),
      text,
    );
    assert.equal(bytes.utf8Decode(bytes.utf8Encode(text)), text);
  }
  const invalid = code("TRANSPORT_PAYLOAD_INVALID");
  for (const sequence of [
    [0x80],
    [0xc0, 0xaf],
    [0xe4, 0xb8],
    [0xf0, 0x9f, 0x98],
    [0xe4, 0x41, 0x41],
    [0xf8, 0x88, 0x80, 0x80, 0x80],
  ]) {
    assert.throws(() => bytes.utf8Decode(new Uint8Array(sequence)), invalid);
  }
});

test("base64:與 Node 的編碼相同,任意長度可往返;非法輸入拒絕", () => {
  for (const length of [0, 1, 2, 3, 4, 5, 255, 256, 257, 4099, 40000]) {
    const raw = new Uint8Array(randomBytes(length));
    const text = bytes.toBase64(raw);
    assert.equal(text, Buffer.from(raw).toString("base64"));
    assert.deepEqual(bytes.fromBase64(text), raw);
  }
  for (const text of ["abc", "ab=c", "a b=", "====", "ab\ncd"]) {
    assert.throws(
      () => bytes.fromBase64(text),
      code("TRANSPORT_PAYLOAD_INVALID"),
    );
  }
});

test("解碼明確拒絕 overlong、surrogate code point 與超出 U+10FFFF;邊界上的合法值與 Buffer 一致", () => {
  const invalid = code("TRANSPORT_PAYLOAD_INVALID");
  for (const sequence of [
    [0xe0, 0x80, 0x80], // overlong
    [0xed, 0xa0, 0x80], // U+D800(surrogate)
    [0xf4, 0x90, 0x80, 0x80], // > U+10FFFF
    [0xc1, 0xbf], // overlong 2-byte
    [0xf0, 0x80, 0x80, 0x80], // overlong 4-byte
    [0xed, 0xbf, 0xbf], // U+DFFF
    [0xf5, 0x80, 0x80, 0x80],
  ]) {
    assert.throws(() => bytes.utf8Decode(new Uint8Array(sequence)), invalid);
    // 夾在合法內容中間也一樣拒絕,不以替代字元掩蓋
    assert.throws(
      () => bytes.utf8Decode(new Uint8Array([0x61, ...sequence, 0x62])),
      invalid,
    );
  }
  for (const text of [
    "\u007f\u0080\u07ff\u0800\ud7ff\ue000\uffff",
    "\u{10000}\u{10FFFF}",
  ]) {
    const encoded = new Uint8Array(Buffer.from(text, "utf8"));
    assert.equal(bytes.utf8Decode(encoded), text);
    assert.deepEqual(bytes.utf8Encode(text), encoded);
  }
});

test("最小重現:fflate 0.8.3 的 strToU8 在沒有 TextEncoder 時把 surrogate pair 編錯;本檔的編碼不受影響", async () => {
  const { buildSync } = await import("esbuild");
  const { default: vm } = await import("node:vm");
  const bundle = buildSync({
    stdin: {
      contents: 'export { strToU8 } from "fflate";',
      resolveDir: process.cwd(),
      loader: "js",
    },
    bundle: true,
    write: false,
    format: "iife",
    globalName: "lib",
    platform: "browser",
  }).outputFiles[0].text;
  const text = "\u{1F600}";
  const expected = [...Buffer.from(text, "utf8")];
  // 沒有 TextEncoder 的環境(Figma 的情況):fflate 走自己的 fallback
  const fallback = JSON.parse(
    vm.runInNewContext(
      `${bundle}; JSON.stringify(Array.from(lib.strToU8(${JSON.stringify(text)})))`,
      {},
    ),
  );
  assert.deepEqual(expected, [0xf0, 0x9f, 0x98, 0x80]);
  assert.notDeepEqual(fallback, expected);
  // 有 TextEncoder 時 fflate 是對的,所以 Node 端測不出來
  const { strToU8 } = await import("fflate");
  assert.deepEqual([...strToU8(text)], expected);
  // 我們的編碼在兩種環境都是同一支純函式
  assert.deepEqual([...bytes.utf8Encode(text)], expected);
});
