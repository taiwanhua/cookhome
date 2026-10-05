/**
 * 傳輸 codec 的 Node 端:把 fflate 的同步 browser exports 打包成可嵌入生成碼的 codec,以及壓縮生成碼的輸入。
 * codec 固定 gzip-base64(level 6、mtime 0、無 filename / dictionary)。嵌入的 bundle 不依賴 TextEncoder、Worker、
 * fetch、Buffer 或 CompressionStream;Node 端解壓走有 maxOutputLength 的 node:zlib。第三方程式由 esbuild 自
 * 已安裝套件打包,MIT notice 取自套件內的 LICENSE,不手抄。
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { buildSync, version as esbuildVersion } from "esbuild";
import { gzipSync } from "fflate";

import { createContract } from "./core-contract.mjs";
import { createTraceBudget } from "./transport-budget.mjs";
import { createByteCodec } from "./transport-bytes.mjs";
import { createPayloadDecoder } from "./transport-decode.mjs";
import {
  createEnvelopeLimits,
  createEnvelopeRules,
} from "./transport-envelope.mjs";
import { createTransportReceiver } from "./transport-receive.mjs";
import { createTransport } from "./transport.mjs";

const require = createRequire(import.meta.url);
const fflatePackage = require("fflate/package.json");
const FFLATE_VERSION = "0.8.3";
const ESBUILD_VERSION = "0.28.2";
const GZIP_OPTIONS = { level: 6, mtime: 0 };

/**
 * 生成碼內的 codec 進入點:只取同步 browser exports 的 gzip / gunzip(UTF-8 走 transport-bytes.mjs)。
 * 直接寫進呼叫端提供的 `__figmaSyncCodec` 物件,不經 esbuild 的 export 包裝(省下固定的 helper 字元)。
 */
const CODEC_ENTRY = `
import { gzipSync, gunzipSync } from "fflate";
__figmaSyncCodec.gzip = (bytes) => gzipSync(bytes, { level: 6, mtime: 0 });
__figmaSyncCodec.gunzip = (bytes) => gunzipSync(bytes);
`;

function assertVersions() {
  const pinned =
    fflatePackage.version === FFLATE_VERSION &&
    esbuildVersion === ESBUILD_VERSION;
  if (!pinned) {
    const error = new Error("CODEC_VERSION_MISMATCH");
    error.name = "FigmaSyncError";
    error.code = "CODEC_VERSION_MISMATCH";
    throw error;
  }
}

let cachedSource = null;

/** 回傳一個 JS 運算式,其值是 Figma 端使用的 codec 物件 {gzip,gunzip};同版本下內容固定。 */
export function createCodecSource() {
  if (cachedSource) return cachedSource;
  assertVersions();
  const result = buildSync({
    stdin: {
      contents: CODEC_ENTRY,
      resolveDir: path.dirname(require.resolve("fflate/package.json")),
      loader: "js",
    },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2017",
    minify: true,
    charset: "ascii",
    legalComments: "none",
  });
  // bundle 是 `(()=>{...})();`,其中把 gzip / gunzip 掛到自由變數 __figmaSyncCodec;包成帶該參數的函式後取回物件
  const bundle = result.outputFiles[0].text.trim().replace(/;$/, "");
  cachedSource = `((__figmaSyncCodec) => { ${bundle}; return __figmaSyncCodec; })({})`;
  return cachedSource;
}

/** fflate 的 MIT notice(取自已安裝套件的 LICENSE),以保留註解放在生成碼開頭。 */
export function codecNotice() {
  const license = readFileSync(
    path.join(path.dirname(require.resolve("fflate/package.json")), "LICENSE"),
    "utf8",
  );
  const lines = license
    .trim()
    .split(/\r?\n/)
    .map((line) => ` * ${line}`.trimEnd());
  return `/*! fflate ${FFLATE_VERSION} (bundled gzip codec)\n${lines.join("\n")}\n */`;
}

/** 來源 digest 用:codec / bundler 的固定版本與實際 bundle 內容。 */
export function codecFingerprint() {
  return {
    fflate: fflatePackage.version,
    esbuild: esbuildVersion,
    codecSource: createCodecSource(),
  };
}

/** Node 端的 codec:壓縮用同版 fflate(與 Figma 端 bytes 相同),解壓用限制輸出長度的 zlib。 */
export function createNodeCodec() {
  return {
    gzip: (bytes) => gzipSync(bytes, GZIP_OPTIONS),
    gunzip: (bytes, maxBytes) =>
      new Uint8Array(gunzipSync(bytes, { maxOutputLength: maxBytes })),
  };
}

/** Node 端的 transport(收件、重建與輸入編碼共用)。 */
export function createNodeTransport(contract = createContract()) {
  const limits = createEnvelopeLimits(contract);
  const bytes = createByteCodec(contract);
  const codec = createNodeCodec();
  const transport = createTransport(contract, codec, {
    bytes,
    envelope: limits,
    decoder: createPayloadDecoder(contract, codec, bytes, limits.LIMITS),
  });
  return Object.assign(
    {},
    transport,
    createTransportReceiver(
      contract,
      transport,
      createEnvelopeRules(contract, limits),
    ),
    { traceBudget: createTraceBudget(contract).traceBudget },
  );
}

/** 生成碼內嵌的 request / plan:整份 canonical JSON 壓縮,附 byteLength 與完整 SHA 供 Figma 端解碼後核對。 */
export function encodeExecutionPayload(value) {
  return createNodeTransport().encodeInput(value);
}
