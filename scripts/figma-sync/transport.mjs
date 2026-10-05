/**
 * 有界傳輸的產生端純運算:payload 的編解碼與 head / chunk / error envelope。無 Node / Figma I/O。
 * 原協定 artifact 先取 canonical JSON、整份 gzip、base64 後切成固定長度區塊;每個 envelope 驗 bytes 上限,
 * 超量明確失敗,不裁切。codec={gzip,gunzip} 由呼叫端注入(Figma 端是同版純 JS,Node 端解壓走 zlib);
 * parts={bytes,envelope}:transport-bytes.mjs 的 UTF-8 / base64、transport-envelope.mjs 的固定預算(createEnvelopeLimits)。
 * 收件端的邊界驗證與組回(assemble)在 transport-receive.mjs,只有 Node 端使用。
 * 會被序列化進 Figma 執行。傳輸協定見本檔匯出介面,操作見 docs/agents/toolbox.md「Figma 品牌同步」。
 */
export function createTransport(contract, codec, parts) {
  const { digest, fail } = contract;
  const { utf8Encode, toBase64, fromBase64 } = parts.bytes;
  const { LIMITS, CODEC, envelopeBytes, chunkDigest } = parts.envelope;

  /** 整份 canonical JSON 先壓縮再切片;超過 payload 或區塊數上限就失敗。 */
  function encodePayload(value) {
    const raw = utf8Encode(contract.canonicalJson(value));
    if (raw.length > LIMITS.payloadBytes) fail("TRANSPORT_PAYLOAD_TOO_LARGE");
    const compressed = codec.gzip(raw);
    const base64 = toBase64(compressed);
    const chunks = [];
    for (let at = 0; at < base64.length; at += LIMITS.chunkChars) {
      chunks.push(base64.slice(at, at + LIMITS.chunkChars));
    }
    if (chunks.length > LIMITS.chunks) fail("TRANSPORT_PAYLOAD_TOO_LARGE");
    return {
      canonicalDigest: digest(value),
      uncompressedBytes: raw.length,
      compressedBytes: compressed.length,
      base64Length: base64.length,
      chunks,
    };
  }

  const { decodePayload, decodeInput } = parts.decoder;

  const common = (request, type, artifactKind, artifactDigest, observed) => ({
    transportVersion: 1,
    type,
    runId: request.runId,
    requestDigest: digest(request),
    operation: request.operation,
    targetFileKey: request.target.fileKey,
    observedFileKey: observed,
    artifactKind,
    artifactDigest,
  });
  const errorEnvelope = (request, artifactKind, code, observed) =>
    Object.assign(common(request, "error", artifactKind, null, observed), {
      code,
    });

  /**
   * 第一次回傳:scan 的 inventory 或 apply 的 attempt。attemptHead 是去除 afterInventory 的完整 attempt,
   * 真 trace / readBack 都在這裡。afterInventory 超量或壓縮失敗時改成真的 interrupted attempt 再定 digest。
   */
  function buildHead(request, artifact) {
    const isAttempt = artifact.kind === "attempt";
    const observed = artifact.observedFileKey;
    let final = artifact;
    let subject = isAttempt ? artifact.afterInventory : artifact;
    let encoded = null;
    if (subject) {
      try {
        encoded = encodePayload(subject);
      } catch (error) {
        if (!isAttempt) {
          return errorEnvelope(
            request,
            "inventory",
            "INVENTORY_TRANSPORT_FAILED",
            observed,
          );
        }
        subject = null;
        final = Object.assign({}, artifact, {
          status: artifact.status === "failed" ? "failed" : "interrupted",
          afterInventory: null,
          afterInventoryDigest: null,
          errors: artifact.errors.concat([
            { code: "AFTER_INVENTORY_TRANSPORT_FAILED", detail: "" },
          ]),
        });
      }
    }
    let attemptHead = null;
    if (isAttempt) {
      attemptHead = Object.assign({}, final);
      delete attemptHead.afterInventory;
    }
    const head = Object.assign(
      common(request, "head", artifact.kind, digest(final), observed),
      {
        codec: CODEC,
        payload: encoded
          ? {
              subject: isAttempt ? "after-inventory" : "inventory",
              canonicalDigest: encoded.canonicalDigest,
              generatedAt: subject.generatedAt,
              uncompressedBytes: encoded.uncompressedBytes,
              compressedBytes: encoded.compressedBytes,
              base64Length: encoded.base64Length,
              chunkSize: LIMITS.chunkChars,
              chunkCount: encoded.chunks.length,
            }
          : null,
        attemptHead,
        chunk0: null,
      },
    );
    if (envelopeBytes(head) > LIMITS.envelopeBytes) {
      return errorEnvelope(
        request,
        artifact.kind,
        "TRANSPORT_HEAD_TOO_LARGE",
        observed,
      );
    }
    if (encoded) {
      const payloadBase64 = encoded.chunks[0];
      const withChunk = Object.assign({}, head, {
        chunk0: {
          index: 0,
          payloadBase64,
          chunkDigest: chunkDigest(0, payloadBase64),
        },
      });
      // 完整 bytes 足夠才附第一塊;否則由下一次唯讀取得,不縮短固定區塊
      if (envelopeBytes(withChunk) <= LIMITS.envelopeBytes) return withChunk;
    }
    return head;
  }

  /**
   * 後續唯讀重掃的一塊:沿第一份 generatedAt,其餘內容的完整 canonical SHA 必須相同,
   * 任何漂移回 TRANSFER_SNAPSHOT_CHANGED(不因名稱或顏色相同放行)。
   */
  function buildChunk(request, head, index, inventory) {
    const kind = head.artifactKind;
    const observed = inventory.observedFileKey;
    const subject = Object.assign({}, inventory, {
      generatedAt: head.payload.generatedAt,
    });
    if (digest(subject) !== head.payload.canonicalDigest) {
      return errorEnvelope(
        request,
        kind,
        "TRANSFER_SNAPSHOT_CHANGED",
        observed,
      );
    }
    const encoded = encodePayload(subject);
    const payloadBase64 = encoded.chunks[index];
    if (payloadBase64 === undefined) fail("TRANSPORT_INDEX_INVALID");
    return Object.assign(
      common(request, "chunk", kind, head.artifactDigest, observed),
      {
        headDigest: head.headDigest,
        index,
        payloadBase64,
        chunkDigest: chunkDigest(index, payloadBase64),
        observedAt: inventory.generatedAt,
      },
    );
  }

  return {
    LIMITS,
    CODEC,
    toBase64,
    fromBase64,
    encodePayload,
    decodePayload,
    decodeInput,
    envelopeBytes,
    errorEnvelope,
    buildHead,
    buildChunk,
    chunkDigest,
  };
}
