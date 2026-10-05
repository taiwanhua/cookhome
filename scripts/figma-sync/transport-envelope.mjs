/**
 * 傳輸 envelope 的固定預算與邊界驗證:任何保存、迴圈或生成下一支 JS 之前,先驗完整的 head / chunk / error 形狀、
 * codec、bytes、chunkCount(1..32)、subject、digest 與 attemptHead。無 Node / Figma I/O。
 * createEnvelopeLimits(固定預算、codec 常數、bytes 與 chunk digest)兩端共用,會被序列化進 Figma 執行;
 * createEnvelopeRules(完整邊界驗證)只有收件的 Node 端使用,不進生成碼。
 * 這裡只判斷「這個包是否合乎協定且屬於這個 request」;observedFileKey 是否等於目標檔由收件端另外處理
 *(正常的 head / chunk 必須 exact,診斷用的失敗結果只封存、不續成功流程)。
 */
export function createEnvelopeLimits(contract) {
  const LIMITS = {
    envelopeBytes: 18000,
    chunkChars: 12288,
    payloadBytes: 16 * 1024 * 1024,
    chunks: 32,
  };
  const CODEC = {
    name: "gzip-base64",
    implementation: "fflate",
    version: "0.8.3",
    level: 6,
    mtime: 0,
  };
  const envelopeBytes = (envelope) =>
    contract.utf8Length(JSON.stringify(envelope));
  const chunkDigest = (index, payloadBase64) =>
    contract.digest({ index, payloadBase64 });

  return { LIMITS, CODEC, envelopeBytes, chunkDigest };
}

/** 收件端(Node)的完整邊界驗證;limits 是上面那一份,兩端用同一組常數。 */
export function createEnvelopeRules(contract, limits) {
  const { digest, fail, isObject } = contract;
  const { LIMITS, CODEC, envelopeBytes, chunkDigest } = limits;
  const COMMON = [
    "transportVersion",
    "type",
    "runId",
    "requestDigest",
    "operation",
    "targetFileKey",
    "observedFileKey",
    "artifactKind",
    "artifactDigest",
  ];
  const KEYS = {
    head: COMMON.concat(["codec", "payload", "attemptHead", "chunk0"]),
    chunk: COMMON.concat([
      "headDigest",
      "index",
      "payloadBase64",
      "chunkDigest",
      "observedAt",
    ]),
    error: COMMON.concat(["code"]),
  };
  const DIGEST = /^[0-9a-f]{64}$/;
  const TIMESTAMP = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/;
  const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

  const isDigest = (value) => typeof value === "string" && DIGEST.test(value);
  const isCount = (value) => Number.isInteger(value) && value >= 0;
  const isText = (value) => typeof value === "string" && value.length > 0;
  const exactKeys = (value, names) =>
    isObject(value) &&
    Object.keys(value).length === names.length &&
    names.every((name) => contract.has(value, name));

  function validBase64(text, expectedLength) {
    return (
      typeof text === "string" &&
      text.length === expectedLength &&
      text.length <= LIMITS.chunkChars &&
      BASE64.test(text)
    );
  }

  function validPayload(payload, attempt) {
    const names = [
      "subject",
      "canonicalDigest",
      "generatedAt",
      "uncompressedBytes",
      "compressedBytes",
      "base64Length",
      "chunkSize",
      "chunkCount",
    ];
    if (!exactKeys(payload, names)) return false;
    const counted = [
      payload.uncompressedBytes,
      payload.compressedBytes,
      payload.base64Length,
      payload.chunkCount,
    ].every(isCount);
    return (
      counted &&
      payload.subject === (attempt ? "after-inventory" : "inventory") &&
      isDigest(payload.canonicalDigest) &&
      TIMESTAMP.test(String(payload.generatedAt)) &&
      payload.uncompressedBytes >= 2 &&
      payload.uncompressedBytes <= LIMITS.payloadBytes &&
      payload.compressedBytes >= 18 &&
      payload.base64Length === Math.ceil(payload.compressedBytes / 3) * 4 &&
      payload.chunkSize === LIMITS.chunkChars &&
      payload.chunkCount >= 1 &&
      payload.chunkCount <= LIMITS.chunks &&
      payload.chunkCount === Math.ceil(payload.base64Length / LIMITS.chunkChars)
    );
  }

  /** 第 index 塊應有的長度:除最後一塊外固定。 */
  const chunkLength = (payload, index) =>
    index === payload.chunkCount - 1
      ? payload.base64Length - LIMITS.chunkChars * index
      : LIMITS.chunkChars;

  function validHead(request, head) {
    const attempt = head.artifactKind === "attempt";
    const payload = head.payload;
    if (
      !contract.sameValue(head.codec, CODEC) ||
      !exactKeys(head.codec, Object.keys(CODEC))
    ) {
      return false;
    }
    if (!isDigest(head.artifactDigest)) return false;
    if (payload !== null && !validPayload(payload, attempt)) return false;
    const trace = head.attemptHead;
    if (attempt) {
      // attemptHead 是去除 afterInventory 的原 attempt:run 與 plan digest 必須是這個 request 的
      const valid =
        isObject(trace) &&
        trace.kind === "attempt" &&
        !contract.has(trace, "afterInventory") &&
        trace.runId === request.runId &&
        trace.planDigest === request.inputDigests.plan &&
        trace.afterInventoryDigest === null &&
        trace.observedFileKey === head.observedFileKey &&
        Array.isArray(trace.completedActions) &&
        Array.isArray(trace.errors) &&
        ["applied", "interrupted", "failed"].includes(trace.status) &&
        // applied 一定帶 afterInventory;沒有 payload 的只能是失敗 / 中斷的 trace
        (payload !== null || trace.status !== "applied");
      if (!valid) return false;
    } else if (trace !== null || payload === null) {
      return false;
    }
    const first = head.chunk0;
    if (first === null) return true;
    return (
      payload !== null &&
      exactKeys(first, ["index", "payloadBase64", "chunkDigest"]) &&
      first.index === 0 &&
      validBase64(first.payloadBase64, chunkLength(payload, 0)) &&
      first.chunkDigest === chunkDigest(0, first.payloadBase64)
    );
  }

  function validChunk(chunk) {
    return (
      isDigest(chunk.artifactDigest) &&
      isDigest(chunk.headDigest) &&
      isCount(chunk.index) &&
      chunk.index < LIMITS.chunks &&
      typeof chunk.payloadBase64 === "string" &&
      chunk.payloadBase64.length > 0 &&
      validBase64(chunk.payloadBase64, chunk.payloadBase64.length) &&
      chunk.chunkDigest === chunkDigest(chunk.index, chunk.payloadBase64) &&
      TIMESTAMP.test(String(chunk.observedAt))
    );
  }

  /** 每個收到的包:完整形狀、屬於這個 request / run / file、在 bytes 上限內。不合格一律拒絕且不保存。 */
  function checkEnvelope(request, envelope) {
    const names = isObject(envelope) ? KEYS[envelope.type] : null;
    const valid =
      names &&
      exactKeys(envelope, names) &&
      envelope.transportVersion === 1 &&
      envelope.runId === request.runId &&
      envelope.requestDigest === digest(request) &&
      envelope.operation === request.operation &&
      envelope.targetFileKey === request.target.fileKey &&
      (envelope.observedFileKey === null || isText(envelope.observedFileKey)) &&
      envelope.artifactKind ===
        (request.operation === "scan" ? "inventory" : "attempt") &&
      envelopeBytes(envelope) <= LIMITS.envelopeBytes &&
      (envelope.type === "head"
        ? validHead(request, envelope)
        : envelope.type === "chunk"
          ? validChunk(envelope)
          : envelope.artifactDigest === null &&
            typeof envelope.code === "string");
    if (!valid) fail("TRANSPORT_ENVELOPE_INVALID");
    return envelope;
  }

  /**
   * chunk 的內容身分:全部固定共用欄位(含 observedFileKey)、headDigest、index、payloadBase64、chunkDigest;
   * 重讀時間 observedAt 不參與。
   */
  const chunkIdentity = (chunk) =>
    digest(
      KEYS.chunk
        .filter((name) => name !== "observedAt")
        .map((name) => chunk[name]),
    );

  return Object.assign({}, limits, {
    chunkLength,
    checkEnvelope,
    chunkIdentity,
  });
}
