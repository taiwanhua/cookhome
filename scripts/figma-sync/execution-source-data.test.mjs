import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import vm from "node:vm";

import {
  packBase64Literal,
  unpackBase64Literal,
} from "./execution-source-data.mjs";

test("base64 純資料 literal 每碼元保存 15 bits；任意 bytes、padding、Unicode JSON 都逐 byte 往返", () => {
  const values = [
    Buffer.from('中文😀\u2028\u2029"\\'),
    Buffer.from(Array.from({ length: 256 }, (_, i) => i)),
  ];
  for (const size of [0, 1, 2, 3, 4, 5, 63, 64, 65, 4099])
    values.push(randomBytes(size));
  for (const value of values) {
    const encoded = value.toString("base64");
    const packed = packBase64Literal(encoded);
    assert.equal(
      packed.length,
      1 + Math.ceil((encoded.replace(/=+$/, "").length * 6) / 15),
    );
    assert.match(packed, /^[\u4000-\ubfff]+$/);
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

test("保留 base64 原字串的所有 bits，包括非典型 padding bits", () => {
  for (const encoded of ["AB==", "AAB=", "/x==", "//9=", "////"])
    assert.equal(unpackBase64Literal(packBase64Literal(encoded)), encoded);
});

test("非法 base64、碼元、header 或尾端 padding 直接失敗；不接受任意 JS 字串", () => {
  for (const value of [null, 7, "abc", "ab=c", "====", "a b=", "eval()"])
    assert.throws(() => packBase64Literal(value), {
      code: "EXECUTION_PAYLOAD_INVALID",
    });
  for (const value of [
    null,
    7,
    "",
    "\u3fff",
    "\uc000",
    "\ud800",
    "\n",
    '"',
    "eval()",
    "\u4030", // header 的 base64 padding 超過兩個。
    "\u400f", // header 的尾端 padding 超過 14 bits。
    "\u4006", // 空資料不可宣稱有尾端 padding。
    "\u4000\u4000", // 資料長度不是完整的 6-bit base64 字元。
    "\u4023\u4001", // AA== 的尾端 padding bits 必須全部為零。
    "\u4023\uc000", // header 後仍逐一驗證資料碼元範圍。
    packBase64Literal("AAAA").slice(0, -1),
  ])
    assert.throws(() => unpackBase64Literal(value), {
      code: "EXECUTION_PAYLOAD_INVALID",
    });
});
