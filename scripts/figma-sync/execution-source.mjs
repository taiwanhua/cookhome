/**
 * 生成在 Figma 執行的 JavaScript:把**同一份受測 factories** 以 `toString()` 序列化,只組該 operation 必需的部分,
 * 連同 codec 與完整壓縮的 request / plan 組成一個具名入口,再由 esbuild 整體轉成 ES2017 並 minify。
 * 不另存字串版實作、不逐支改名拼接、不 mangle properties、不 eval 使用者資料。
 * scan 與唯讀分塊入口只含 contract、assets、source、scanner 與傳輸;apply 才另含 recovery 與 executor。
 */
import { createRequire } from "node:module";

import { transformSync } from "esbuild";
import { minify_sync } from "terser";
import ts from "typescript";

import { createRecordSchema } from "./core-contract-schema-records.mjs";
import {
  createContractSchema,
  createSchemaDefinitions,
} from "./core-contract-schema.mjs";
import {
  APPLY_CONTRACT_FACTORIES,
  SCAN_CONTRACT_FACTORIES,
  SCENE_APPLY_CONTRACT_FACTORIES,
  assembleContract,
  createContract,
} from "./core-contract.mjs";
import {
  createAssetClassifier,
  createSceneClassifier,
} from "./core-recovery-classify.mjs";
import { assembleRecovery, createRecoveryCore } from "./core-recovery.mjs";
import { poolExecutionSource } from "./execution-source-constants.mjs";
import {
  packBase64Literal,
  unpackBase64Literal,
} from "./execution-source-data.mjs";
import {
  ASSET_APPLY_FACTORIES,
  SCAN_FACTORIES,
  SCENE_APPLY_FACTORIES,
  assembleRuntime,
} from "./runtime.mjs";
import { createTraceBudget } from "./transport-budget.mjs";
import { createByteCodec } from "./transport-bytes.mjs";
import {
  codecNotice,
  createCodecSource,
  createNodeTransport,
} from "./transport-codec.mjs";
import { createPayloadDecoder } from "./transport-decode.mjs";
import { createEnvelopeLimits } from "./transport-envelope.mjs";
import {
  createRuntimeTransport,
  runTransportEntry,
} from "./transport-runtime.mjs";
import { createTransport } from "./transport.mjs";

const contract = createContract();
const require = createRequire(import.meta.url);
const terserVersion = require("terser/package.json").version;

export function sourceCompilerFingerprint() {
  if (ts.version !== "5.9.3" || terserVersion !== "5.49.0") {
    contract.fail("SOURCE_COMPILER_VERSION_MISMATCH");
  }
  return { typescript: ts.version, terser: terserVersion };
}

/** 工具輸入驗證對 `code` 的硬上限(字元數;實測超過即在送入前被拒絕)。 */
export const MAX_TOOL_CODE_CHARS = 50000;
/** 完整 tool arguments JSON(UTF-8 bytes)的上限;超量明確失敗,不裁切內容。 */
export const MAX_TOOL_ARGUMENT_BYTES = 128 * 1024;
const TOOL_LIMITS = {
  codeChars: MAX_TOOL_CODE_CHARS,
  argumentBytes: MAX_TOOL_ARGUMENT_BYTES,
};

/** 兩個上限各自驗證:code 的字元數,以及完整 arguments JSON 的 UTF-8 bytes。 */
function checkToolArguments(args, limits) {
  const bytes = Buffer.byteLength(JSON.stringify(args), "utf8");
  if (args.code.length > limits.codeChars || bytes > limits.argumentBytes) {
    contract.fail("EXECUTION_SOURCE_TOO_LARGE");
  }
  return args;
}

/**
 * 交給現有 use_figma 工具的實際參數,固定四個欄位。generator 與實際 caller 都用這一支,
 * 驗 code 最多 50,000 字元,並以 `JSON.stringify(args)` 的 UTF-8 bytes 驗 128 KiB 預算(含 code 的 escaping 與其他欄位);
 * 任一超限回 EXECUTION_SOURCE_TOO_LARGE。caller 不改寫回傳的參數。source 檔自身的 SHA 仍只計原始 source bytes,與這裡無關。
 */
export function buildFigmaToolArguments({ fileKey, source }) {
  if (typeof fileKey !== "string" || fileKey === "") {
    contract.fail("FILE_KEY_INVALID");
  }
  if (typeof source !== "string" || source === "") {
    contract.fail("EXECUTION_SOURCE_INVALID");
  }
  return checkToolArguments(toolArguments(fileKey, source), TOOL_LIMITS);
}

const toolArguments = (fileKey, source) => ({
  fileKey,
  code: source,
  description: "Execute verified Figma sync request",
  skillNames: "figma-use,figma-generate-library",
});

/** scan / 唯讀分塊入口的固定 factory 清單:contract 只有 request / inventory,沒有 executor,也沒有 recovery。 */
export const SCAN_ENTRY_FACTORIES = Object.assign(
  {},
  SCAN_CONTRACT_FACTORIES,
  {
    assembleContract,
    createByteCodec,
    createEnvelopeLimits,
    createTransport,
    createPayloadDecoder,
  },
  SCAN_FACTORIES,
  { assembleRuntime, createRuntimeTransport, runTransportEntry },
);
const APPLY_SHARED = {
  createTraceBudget,
  createRecoveryCore,
  assembleRecovery,
};
/** consumer 的 apply 入口:另加 plan / attempt、相依圖、guards、場景的逐筆判定與 writer。 */
export const SCENE_APPLY_ENTRY_FACTORIES = Object.assign(
  {},
  SCAN_ENTRY_FACTORIES,
  SCENE_APPLY_CONTRACT_FACTORIES,
  APPLY_SHARED,
  { createSceneClassifier },
  SCENE_APPLY_FACTORIES,
);
/** 品牌庫的 apply 入口:資產 action 的相依圖規則、逐筆判定與 writer(不含場景 writer)。 */
export const ASSET_APPLY_ENTRY_FACTORIES = Object.assign(
  {},
  SCAN_ENTRY_FACTORIES,
  APPLY_CONTRACT_FACTORIES,
  APPLY_SHARED,
  { createAssetClassifier },
  ASSET_APPLY_FACTORIES,
);
/** 兩種 apply 的聯集:Node 端測試拿它與完整 factories 比對;生成碼依 targetKind 只取上面其中一份。 */
export const APPLY_ENTRY_FACTORIES = Object.assign(
  {},
  SCENE_APPLY_ENTRY_FACTORIES,
  ASSET_APPLY_ENTRY_FACTORIES,
);
/** plan 的相依圖已限定:品牌庫只有資產 action、consumer 只有場景 action、base-library 沒有 action。 */
export const applyEntryFactories = (targetKind) =>
  targetKind === "brand-library"
    ? ASSET_APPLY_ENTRY_FACTORIES
    : SCENE_APPLY_ENTRY_FACTORIES;

function render(factories, input, fileKey) {
  sourceCompilerFingerprint();
  const transport = createNodeTransport(contract);
  const definitions = {
    schema: createSchemaDefinitions(contract),
    records: null,
  };
  if (factories.createPlanGraph) {
    definitions.records = createRecordSchema(
      createContractSchema(contract),
    ).bodies;
  }
  // Runtime 只讀這兩個共用片段；request/inventory/plan/attempt 的 bodies 全部保留。
  const { SCENE_LOCATOR, ASSET_LOCATOR } = definitions.schema.pieces;
  definitions.schema.pieces = { SCENE_LOCATOR, ASSET_LOCATOR };
  const bootstrapNames = [
    "createContractValues",
    "createByteCodec",
    "createPayloadDecoder",
    "createEnvelopeLimits",
  ];
  const names = Object.keys(factories).filter(
    (name) => !["createSchemaDefinitions", "createRecordSchema"].includes(name),
  );
  const entry = [
    "async function __figmaSyncEntry(figma, __figmaSyncConstants, codec, input) {",
    ...names
      .filter((name) => !bootstrapNames.includes(name))
      .map((name) => factories[name].toString()),
    `const factories = { ${names.join(", ")} };`,
    "return runTransportEntry(figma, codec, input, factories, true);",
    "}",
  ].join("\n");
  const pooled = poolExecutionSource(entry);
  const payload = transport.encodeInput({
    constants: pooled.constants,
    schema: definitions,
    request: transport.decodeInput(input.request),
    plan: input.plan ? transport.decodeInput(input.plan) : null,
    read: input.read,
  });
  const program = [
    "async function __figmaSyncBootstrap(figma) {",
    `const codec = ${createCodecSource()};`,
    ...bootstrapNames.map((name) => factories[name].toString()),
    "const values = createContractValues();",
    "const bytes = createByteCodec(values);",
    "const decoder = createPayloadDecoder(values, codec, bytes, createEnvelopeLimits(values).LIMITS);",
    unpackBase64Literal.toString(),
    `const input = decoder.decodeInput({ base64: unpackBase64Literal(${JSON.stringify(packBase64Literal(payload.base64))}), uncompressedBytes: ${payload.uncompressedBytes}, canonicalDigest: ${JSON.stringify(payload.canonicalDigest)} });`,
    pooled.source,
    "return __figmaSyncEntry(figma, input.constants, codec, input);",
    "}",
  ].join("\n");
  const { code } = transformSync(program, {
    target: "es2017",
    minify: true,
    charset: "utf8",
    legalComments: "none",
  });
  const minified = minify_sync(code, {
    ecma: 2017,
    compress: { passes: 3, unsafe: false, pure_getters: false },
    mangle: { properties: false, reserved: ["__figmaSyncBootstrap"] },
    format: { ascii_only: false, comments: false },
  });
  if (!minified.code) contract.fail("SOURCE_COMPILER_FAILED");
  const source = [
    codecNotice(),
    "// figma-sync execution-source: generated by scripts/figma-sync/execution-source.mjs; do not edit.",
    "// Run with the existing Figma tool; save the returned JSON value as-is, then: record --transport-result <file>",
    minified.code.trim(),
    "return await __figmaSyncBootstrap(figma);",
    "",
  ].join("\n");
  // 以實際的工具參數驗兩個上限(不只 source 的 bytes)
  checkToolArguments(toolArguments(fileKey, source), TOOL_LIMITS);
  return source;
}

function checkedRequest(request) {
  if (contract.validateArtifact(request).kind !== "request") {
    contract.fail("ARTIFACT_KIND_MISMATCH", "request");
  }
  return request;
}

/**
 * 首次入口:scan 回 inventory 的 head;apply 執行一次並回 attempt 的 head。
 * 與實際 caller 共用固定 code 字元 / 完整 arguments bytes 上限，不提供放寬選項。
 */
export function buildExecutionSource({ request, plan }) {
  checkedRequest(request);
  const transport = createNodeTransport(contract);
  const applying = request.operation === "apply";
  if (applying !== Boolean(plan)) contract.fail("REQUEST_OPERATION_INVALID");
  if (applying) {
    const valid =
      contract.validateArtifact(plan).kind === "plan" &&
      contract.digest(plan) === request.inputDigests.plan &&
      plan.runId === request.runId;
    if (!valid) contract.fail("PLAN_CHANGED");
  }
  return render(
    applying ? applyEntryFactories(request.targetKind) : SCAN_ENTRY_FACTORIES,
    {
      request: transport.encodeInput(request),
      plan: applying ? transport.encodeInput(plan) : null,
      read: null,
    },
    request.target.fileKey,
  );
}

/**
 * 後續的唯讀分塊入口:重掃同一 scope,內容與 head 記錄的完整 digest 相同才回第 index 塊。
 * 這支生成碼不含 executor,也不帶 plan;對 apply 的 run 一樣只會掃描。
 */
export function buildReadonlyTransportSource({ request, head, index }) {
  checkedRequest(request);
  const transport = createNodeTransport(contract);
  transport.checkEnvelope(request, head);
  const payload = head.payload;
  const valid =
    head.type === "head" &&
    payload !== null &&
    Number.isInteger(index) &&
    index >= 0 &&
    index < payload.chunkCount;
  if (!valid) contract.fail("TRANSPORT_INDEX_INVALID");
  return render(
    SCAN_ENTRY_FACTORIES,
    {
      request: transport.encodeInput(request),
      plan: null,
      read: {
        index,
        head: {
          artifactKind: head.artifactKind,
          artifactDigest: head.artifactDigest,
          payload,
          headDigest: contract.digest(head),
        },
      },
    },
    request.target.fileKey,
  );
}
