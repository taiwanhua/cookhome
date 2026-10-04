import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

import { transformSync } from "esbuild";
import ts from "typescript";

import { poolExecutionSource } from "./execution-source-constants.mjs";

const execute = async (source, constants, figma = {}) => {
  const output = await vm.runInNewContext(
    `${source}\n__figmaSyncEntry(figma, constants)`,
    { figma, constants },
  );
  return JSON.parse(JSON.stringify(output));
};
const equivalent = async (source, figma) => {
  const pooled = poolExecutionSource(source);
  const before = await execute(source, undefined, figma);
  const after = await execute(pooled.source, pooled.constants, figma);
  assert.deepEqual(after, before);
  // esbuild 仍是正式最終產碼器,不能只證明 TypeScript printer 的結果可執行。
  const compiled = transformSync(pooled.source, {
    target: "es2017",
    minify: true,
    charset: "ascii",
  }).code;
  assert.deepEqual(await execute(compiled, pooled.constants, figma), before);
  return pooled;
};

test("共用屬性名稱與常量仍保留原協定鍵、值及方法的 this", async () => {
  const source = `async function __figmaSyncEntry(figma) {
    const data = { longProtocolName: "first-value", untouched: 4 };
    data.longProtocolName = figma.longProtocolName;
    const receiver = { longProtocolName: "method-value",
      longMethodName() { return this.longProtocolName; } };
    const { longProtocolName: captured } = data;
    return { longProtocolName: data.longProtocolName,
      keys: Object.keys(data), captured, method: receiver.longMethodName() };
  }`;
  const pooled = await equivalent(source, { longProtocolName: "new-value" });
  assert.ok(pooled.constants.includes("longProtocolName"));
  assert.ok(pooled.constants.every((value) => typeof value === "string"));
  assert.deepEqual(poolExecutionSource(source), pooled);
});

test("跳脫、Unicode、emoji 與像程式碼的字串只當資料", async () => {
  const values = [
    'quote" backslash\\ newline\n tab\t',
    "繁體中文 \u{1f600} \u2028 \u2029",
    "lone-surrogate \ud800",
    "eval('still-data'); new Function('still-data')",
    "long-\u0065scaped-property",
  ];
  const source = `async function __figmaSyncEntry(figma) {
    const values = ${JSON.stringify(values)};
    const object = { "long-escaped-property": values[0] };
    return { values, property: object["long-escaped-property"] };
  }`;
  const pooled = await equivalent(source);
  for (const value of values) assert.ok(pooled.constants.includes(value));
  const file = ts.createSourceFile("out.js", pooled.source, 99, true, 1);
  const dynamicCode = [];
  const walk = (node) => {
    if (
      (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
      ts.isIdentifier(node.expression) &&
      ["eval", "Function"].includes(node.expression.text)
    ) {
      dynamicCode.push(node.expression.text);
    }
    ts.forEachChild(node, walk);
  };
  walk(file);
  assert.deepEqual(dynamicCode, []);
});

test("optional chain 保留短路、方法 receiver 與 undefined 結果", async () => {
  const source = `async function __figmaSyncEntry(figma) {
    let called = 0;
    const receiver = { longProtocolName: "value",
      longMethodName() { called += 1; return this.longProtocolName; } };
    const absent = figma.absent;
    return [receiver?.longMethodName?.(), absent?.longMethodName?.(), called];
  }`;
  await equivalent(source, { absent: null });
});

test("prototype setter、shorthand、getter 與 directive 的原語意保留", async () => {
  const source = `async function __figmaSyncEntry(figma) {
    "use strict";
    const shorthand = "shared-value";
    const object = { __proto__: null, shorthand,
      get longGetterName() { return "getter-value"; } };
    const own = { ["__proto__"]: "own-value" };
    return { strict: (function () { return this; })() === undefined,
      nullPrototype: Object.getPrototypeOf(object) === null,
      ownProto: Object.prototype.hasOwnProperty.call(own, "__proto__"),
      shorthand: object.shorthand, getter: object.longGetterName };
  }`;
  await equivalent(source);
});

test("分支與 guard 沒被刪除,回傳的物件形狀逐欄相同", async () => {
  const source = `async function __figmaSyncEntry(figma) {
    const request = { targetFileKey: figma.targetFileKey };
    if (request.targetFileKey !== figma.observedFileKey) {
      return { status: "failed", errorCode: "FILE_KEY_MISMATCH" };
    }
    return { status: "applied", targetFileKey: request.targetFileKey };
  }`;
  await equivalent(source, { targetFileKey: "A", observedFileKey: "B" });
  await equivalent(source, { targetFileKey: "A", observedFileKey: "A" });
});

test("不改入口外的 codec 與常量,不處理 template raw 或 regex", async () => {
  const source = `const codec = { longCodecProperty: "outside-only-value" };
  async function __figmaSyncEntry(figma) {
    const regex = /long-regex-value/;
    return [codec.longCodecProperty, regex.source, String.raw\`raw\\nvalue\`];
  }`;
  const pooled = await equivalent(source);
  assert.ok(!pooled.constants.includes("outside-only-value"));
  assert.ok(!pooled.constants.includes("long-regex-value"));
  assert.ok(!pooled.constants.includes("raw\\nvalue"));
});

test("錯誤輸入、重複入口與 reserved binding 碰撞明確失敗", () => {
  const invalid = (code) => (error) => error.code === code;
  for (const source of [
    "",
    "async function __figmaSyncEntry(figma) {",
    "async function other(figma) {}",
    "async function __figmaSyncEntry(...a) {}",
    "function __figmaSyncEntry(a) {} function __figmaSyncEntry(b) {}",
  ]) {
    assert.throws(
      () => poolExecutionSource(source),
      invalid("EXECUTION_SOURCE_INVALID"),
    );
  }
  for (const name of ["__figmaSyncConstants", "__figmaSyncLiteral0"]) {
    assert.throws(
      () =>
        poolExecutionSource(
          `async function __figmaSyncEntry(figma) { const ${name} = 1; }`,
        ),
      invalid("EXECUTION_CONSTANTS_COLLISION"),
    );
  }
});

test("已固定的 constants 第二參數及後續 codec / input 參數維持順序", async () => {
  for (const parameters of [
    "figma,codec,input",
    "figma,__figmaSyncConstants,codec,input",
  ]) {
    const pooled =
      poolExecutionSource(`async function __figmaSyncEntry(${parameters}) {
      return [figma.fileKey,codec.longCodecName,input.longInputName];
    }`);
    const actual = await vm.runInNewContext(
      `${pooled.source}\n__figmaSyncEntry({fileKey:"file"},constants,{longCodecName:"codec"},{longInputName:"input"})`,
      { constants: pooled.constants },
    );
    assert.deepEqual(JSON.parse(JSON.stringify(actual)), [
      "file",
      "codec",
      "input",
    ]);
  }
});

test("pool 為普通 JSON 資料,無常量的入口也可用相同呼叫介面", async () => {
  const source = "async function __figmaSyncEntry(figma) { return 17; }";
  const pooled = await equivalent(source);
  assert.deepEqual(pooled.constants, []);
  assert.deepEqual(JSON.parse(JSON.stringify(pooled.constants)), []);
});

test("shorthand 與物件解構共用固定鍵,local binding、default 與 rest 不變", async () => {
  const source = `async function __figmaSyncEntry(figma) {
    const scope = "scope-value", sourceMatch = "source-value";
    const protectedSnapshot = { status: "protected-value" };
    const original = { scope, sourceMatch, protectedSnapshot };
    const { scope: captured, sourceMatch: receivedMatch, ...remaining } = original;
    const { missingValue = () => "default-value" } = original;
    const [arrayBinding, ...arrayRemaining] = [captured, "tail-value"];
    let assignedValue;
    ({ assignedValue = "assignment-default" } = {});
    return { captured, sourceMatch: receivedMatch, remaining, arrayBinding, arrayRemaining,
      defaultValue: missingValue(), assignedValue,
      keys: Object.keys(original) };
  }`;
  const pooled = await equivalent(source);
  for (const value of [
    "scope",
    "sourceMatch",
    "protectedSnapshot",
    "missingValue",
  ]) {
    assert.ok(pooled.constants.includes(value));
  }
  // 陣列 binding / rest 不是 object key,不能變成 computed property binding。
  assert.match(pooled.source, /\[arrayBinding, \.\.\.arrayRemaining\]/);
  assert.match(pooled.source, /\.\.\.remaining/);
});

test("無插值模板以 cooked string 共用,tagged template 整段保留 raw 與 substitutions", async () => {
  const source =
    "async function __figmaSyncEntry(figma) {\n" +
    "const plain = `template\\nvalue 😀`;\n" +
    "const obj = { longTagName(strings, value) { return [strings.raw[0], strings[0], value]; } };\n" +
    'const tagged = obj.longTagName`tagged\\nraw${"inside-tag-only"}`;\n' +
    "return [plain, tagged, `prefix-${figma.name}`];\n}";
  const pooled = await equivalent(source, { name: "project" });
  assert.ok(pooled.constants.includes("template\nvalue 😀"));
  assert.ok(!pooled.constants.includes("inside-tag-only"));
  assert.match(
    pooled.source,
    /obj\.longTagName\s*`tagged\\nraw\$\{"inside-tag-only"\}`/,
  );
});

test("同名 shorthand 解構仍保留原本 local identifier", async () => {
  const source = `async function __figmaSyncEntry(figma) {
    const { sourceMatch, protectedSnapshot = "default-value" } = figma;
    return { sourceMatch, protectedSnapshot };
  }`;
  const pooled = await equivalent(source, { sourceMatch: "original-value" });
  assert.ok(pooled.constants.includes("sourceMatch"));
  assert.ok(pooled.constants.includes("protectedSnapshot"));
});

test("TypeScript compiler 版本漂移在產碼前明確拒絕", () => {
  const moduleSource = readFileSync(
    new URL("./execution-source-constants.mjs", import.meta.url),
    "utf8",
  );
  const compiled = transformSync(moduleSource, {
    format: "cjs",
    target: "es2017",
  }).code;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: (name) => {
      assert.equal(name, "typescript");
      return { ...ts, version: "0.0.0" };
    },
  });
  assert.throws(
    () =>
      module.exports.poolExecutionSource(
        "async function __figmaSyncEntry(figma) {}",
      ),
    (error) => error.code === "SOURCE_COMPILER_VERSION_MISMATCH",
  );
});
