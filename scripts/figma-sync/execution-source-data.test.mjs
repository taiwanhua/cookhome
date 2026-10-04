import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import vm from "node:vm";

import {
  packBase64Literal,
  unpackBase64Literal,
} from "./execution-source-data.mjs";

test("base64 純資料 literal 減半碼元；任意 bytes、padding、Unicode JSON 都逐 byte 往返", () => {
  const values = [
    Buffer.from('中文😀\u2028\u2029"\\'),
    Buffer.from(Array.from({ length: 256 }, (_, i) => i)),
  ];
  for (const size of [0, 1, 2, 3, 4, 5, 63, 64, 65, 4099])
    values.push(randomBytes(size));
  for (const value of values) {
    const encoded = value.toString("base64");
    const packed = packBase64Literal(encoded);
    assert.equal(packed.length * 2, encoded.length);
    assert.match(packed, /^[\u4000-\u5080]*$/);
    assert.equal(unpackBase64Literal(packed), encoded);
    assert.equal(
      unpackBase64Literal(JSON.parse(JSON.stringify(packed))),
      encoded,
    );
    assert.equal(
      unpackBase64Literal(Buffer.from(packed).toString("utf8")),
      encoded,
    );
    assert.equal(
      vm.runInNewContext(
        `(${unpackBase64Literal.toString()})(${JSON.stringify(packed)})`,
        {},
      ),
      encoded,
    );
  }
});

test("非法 base64 或超出純資料碼元範圍直接失敗；不接受任意 JS 字串", () => {
  for (const value of [null, 7, "abc", "ab=c", "====", "a b=", "eval()"])
    assert.throws(() => packBase64Literal(value), {
      code: "EXECUTION_PAYLOAD_INVALID",
    });
  for (const value of [
    null,
    7,
    "\u3fff",
    "\u5081",
    "\ud800",
    "\n",
    '"',
    "eval()",
  ])
    assert.throws(() => unpackBase64Literal(value), {
      code: "EXECUTION_PAYLOAD_INVALID",
    });
});
