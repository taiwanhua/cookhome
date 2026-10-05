/**
 * record 的傳輸收件:把 Figma 回傳的 head / chunk / error envelope 以固定檔名 append 到 run 的 transport 目錄,
 * 還缺區塊時生成下一支唯讀 JS;接齊後組回完整的原協定 artifact 交回 record。這裡不寫成功 receipt。
 * 檔名與序號由 CLI 產生:首次新增、相同重送冪等、異內容拒絕;observedAt 不參與 chunk 的內容身分,重送保留首包。
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  hashArtifact,
  writeExecutionSource,
  writeFileOnce,
} from "./artifacts.mjs";
import { buildReadonlyTransportSource } from "./execution-source.mjs";
import { createNodeTransport } from "./transport-codec.mjs";

const pad = (index) => String(index).padStart(6, "0");
const readJson = (target) => JSON.parse(readFileSync(target, "utf8"));
const ERROR_CODE = /^[A-Z][A-Z_]{0,63}$/;

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.name = "FigmaSyncError";
  error.code = code;
  throw error;
}

/**
 * 回傳 {complete:true, artifact} 或 {complete:false, artifacts:[下一支唯讀 JS], counts}。
 * 任何保存、迴圈或生成下一支 JS 之前先驗完整 envelope;不合協定的包不留下任何檔案。
 * error envelope 先保存再丟出 TRANSPORT_ERROR;傳輸錯誤不代表先前的 mutation 沒發生。
 */
export function recordTransport({ request, envelope, runDir }) {
  const transport = createNodeTransport();
  transport.checkEnvelope(request, envelope);
  const relative = `transport/${request.operation}`;
  const file = (name) => path.join(runDir, relative, name);
  /** 首次新增;已存在時內容身分必須相同(保留首次封存的包,不覆寫)。 */
  const store = (name, value, identity, changed) => {
    const text = `${JSON.stringify(value, null, 2)}\n`;
    if (writeFileOnce(file(name), text)) return;
    if (identity(readJson(file(name))) !== identity(value)) fail(changed);
  };

  /** 診斷用的包(error、觀測到別的檔)以流水號封存;相同內容重送不另存。 */
  const archiveDiagnostic = () => {
    let index = 0;
    while (
      existsSync(file(`error-${pad(index)}.json`)) &&
      hashArtifact(readJson(file(`error-${pad(index)}.json`))) !==
        hashArtifact(envelope)
    ) {
      index += 1;
    }
    store(
      `error-${pad(index)}.json`,
      envelope,
      hashArtifact,
      "TRANSPORT_ERROR",
    );
  };
  if (envelope.type === "error") {
    archiveDiagnostic();
    const code = ERROR_CODE.test(String(envelope.code)) ? envelope.code : "";
    fail("TRANSPORT_ERROR", code);
  }
  // 正常的 head / chunk 必須來自目標檔(exact)。觀測到別的檔或讀不到 fileKey 的結果只封存、不續成功流程;
  // 唯一例外是沒有 afterInventory 的失敗 attempt:它本身就是診斷,原樣組回交給 record 封存後失敗。
  const failedAttempt =
    envelope.type === "head" &&
    envelope.artifactKind === "attempt" &&
    envelope.payload === null;
  if (envelope.observedFileKey !== request.target.fileKey && !failedAttempt) {
    archiveDiagnostic();
    fail("TRANSPORT_FILE_KEY_MISMATCH");
  }

  if (envelope.type === "head") {
    store("head.json", envelope, hashArtifact, "TRANSPORT_HEAD_CHANGED");
  } else if (!existsSync(file("head.json"))) {
    fail("TRANSPORT_HEAD_MISSING");
  }
  const head = readJson(file("head.json"));
  const headDigest = hashArtifact(head);
  const total = head.payload ? head.payload.chunkCount : 0;
  const expectedLength = (index) =>
    index === total - 1
      ? head.payload.base64Length - transport.LIMITS.chunkChars * index
      : transport.LIMITS.chunkChars;
  const keep = (chunk) => {
    const valid =
      Number.isInteger(chunk.index) &&
      chunk.index >= 0 &&
      chunk.index < total &&
      chunk.headDigest === headDigest &&
      chunk.artifactDigest === head.artifactDigest &&
      chunk.observedFileKey === head.observedFileKey &&
      chunk.payloadBase64.length === expectedLength(chunk.index) &&
      chunk.chunkDigest ===
        transport.chunkDigest(chunk.index, chunk.payloadBase64);
    if (!valid) fail("TRANSPORT_CHUNK_INVALID");
    store(
      `chunk-${pad(chunk.index)}.json`,
      chunk,
      transport.chunkIdentity,
      "TRANSPORT_CHUNK_CHANGED",
    );
  };
  if (envelope.type === "chunk") keep(envelope);
  if (envelope.type === "head" && envelope.chunk0) {
    // head 附帶的第一塊存成同型的 chunk 檔,之後與唯讀取得的區塊一起組回
    const common = Object.assign({}, envelope, { type: "chunk" });
    for (const name of ["codec", "payload", "attemptHead", "chunk0"]) {
      delete common[name];
    }
    keep(
      Object.assign(common, envelope.chunk0, {
        headDigest,
        observedAt: envelope.payload.generatedAt,
      }),
    );
  }

  const chunks = [];
  let missing = null;
  for (let index = 0; index < total; index += 1) {
    const target = file(`chunk-${pad(index)}.json`);
    if (existsSync(target)) chunks.push(readJson(target));
    else if (missing === null) missing = index;
  }
  const counts = { receivedChunks: chunks.length, totalChunks: total };
  if (missing === null) {
    return {
      complete: true,
      artifact: transport.assemble(request, head, chunks),
      counts,
    };
  }
  const source = buildReadonlyTransportSource({
    request,
    head,
    index: missing,
  });
  const written = writeExecutionSource({
    runDir,
    name: `${relative}/read-${pad(missing)}.js`,
    source,
  });
  return { complete: false, artifacts: [written], counts };
}
