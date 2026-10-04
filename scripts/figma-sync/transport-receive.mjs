/**
 * 有界傳輸的收件端純運算:生成碼輸入的壓縮、每個 envelope 的邊界驗證、接齊後組回原協定。只有 Node 端使用,不進生成碼。
 * transport 是 transport.mjs 的產生端(同一份 codec 與預算),rules 是 transport-envelope.mjs 的 createEnvelopeRules。
 * 無 Node / Figma I/O。規格正本:docs/plans/base-sync.md「有界傳輸與完整性」。
 */
export function createTransportReceiver(contract, transport, rules) {
  const { digest, fail } = contract;
  const { LIMITS, chunkDigest, encodePayload, decodePayload } = transport;
  const { checkEnvelope, chunkIdentity } = rules;

  /** 生成碼內嵌的 request / plan:完整壓縮,不刪欄位換取較小請求。 */
  function encodeInput(value) {
    const encoded = encodePayload(value);
    return {
      base64: encoded.chunks.join(""),
      uncompressedBytes: encoded.uncompressedBytes,
      canonicalDigest: encoded.canonicalDigest,
    };
  }
  /** 接齊後組回原協定:驗所有 index、bytes、gzip、canonical SHA,apply 再驗完整 raw attempt digest。 */
  function assemble(request, head, chunks) {
    checkEnvelope(request, head);
    const headDigest = digest(head);
    const payload = head.payload;
    let subject = null;
    if (payload) {
      const sized =
        payload.chunkSize === LIMITS.chunkChars &&
        payload.chunkCount >= 1 &&
        payload.chunkCount <= LIMITS.chunks &&
        chunks.length === payload.chunkCount;
      if (!sized) fail("TRANSPORT_CHUNKS_INCOMPLETE");
      chunks.forEach((chunk, index) => {
        checkEnvelope(request, chunk);
        const last = index === payload.chunkCount - 1;
        const valid =
          chunk.type === "chunk" &&
          chunk.index === index &&
          chunk.headDigest === headDigest &&
          chunk.artifactDigest === head.artifactDigest &&
          chunk.chunkDigest === chunkDigest(index, chunk.payloadBase64) &&
          (last || chunk.payloadBase64.length === LIMITS.chunkChars);
        if (!valid) fail("TRANSPORT_CHUNK_INVALID", String(index));
      });
      const base64 = chunks.map((chunk) => chunk.payloadBase64).join("");
      if (base64.length !== payload.base64Length) {
        fail("TRANSPORT_PAYLOAD_INVALID", "length");
      }
      subject = decodePayload(base64, payload);
    }
    const artifact =
      head.artifactKind === "attempt"
        ? Object.assign({}, head.attemptHead, { afterInventory: subject })
        : subject;
    if (!artifact || digest(artifact) !== head.artifactDigest) {
      fail("TRANSPORT_PAYLOAD_INVALID", "artifact");
    }
    return contract.validateArtifact(artifact);
  }

  return {
    encodeInput,
    assemble,
    checkEnvelope,
    chunkIdentity,
    chunkLength: rules.chunkLength,
  };
}
