import assert from "node:assert/strict";
import { test } from "node:test";

import { contract } from "./test-support.mjs";
import { createByteCodec } from "./transport-bytes.mjs";
import { createNodeCodec, createNodeTransport } from "./transport-codec.mjs";
import { createPayloadDecoder } from "./transport-decode.mjs";
import { createEnvelopeLimits } from "./transport-envelope.mjs";

const transport = createNodeTransport();
const decoder = createPayloadDecoder(
  contract,
  createNodeCodec(),
  createByteCodec(contract),
  createEnvelopeLimits(contract).LIMITS,
);

test("共同 decoder 無損還原完整資料，schema/request/plan 內容改動及長度或 SHA 錯誤都拒絕", () => {
  const input = {
    schema: { fields: ["nodes", "scope"] },
    request: { name: "測試😀" },
    plan: { guards: [1, 2, 3] },
  };
  const encoded = transport.encodeInput(input);
  assert.deepEqual(decoder.decodeInput(encoded), input);
  for (const key of ["schema", "request", "plan"]) {
    const changed = transport.encodeInput({ ...input, [key]: {} });
    assert.throws(
      () =>
        decoder.decodeInput({
          ...changed,
          canonicalDigest: encoded.canonicalDigest,
        }),
      { code: "TRANSPORT_PAYLOAD_INVALID" },
    );
  }
  assert.throws(
    () =>
      decoder.decodeInput({
        ...encoded,
        uncompressedBytes: encoded.uncompressedBytes + 1,
      }),
    { code: "TRANSPORT_PAYLOAD_INVALID" },
  );
});
