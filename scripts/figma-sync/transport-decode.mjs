/** 共用的有界 gzip JSON decoder；生成碼先還原固定資料，runtime 與 Node 收件沿同一實作。 */
export function createPayloadDecoder(contract, codec, bytes, limits) {
  const { digest, fail } = contract;
  const { utf8Decode, fromBase64 } = bytes;
  const LIMITS = limits;
  /** 解回原值:先驗 gzip 尾端宣告的長度,再解壓、驗 byteLength 與完整 canonical SHA。 */
  function decodePayload(base64, expected) {
    const compressed = fromBase64(base64);
    const size = compressed.length;
    const declared =
      size < 18
        ? -1
        : (compressed[size - 4] |
            (compressed[size - 3] << 8) |
            (compressed[size - 2] << 16) |
            (compressed[size - 1] << 24)) >>>
          0;
    const bounded =
      declared === expected.uncompressedBytes &&
      declared <= LIMITS.payloadBytes &&
      (expected.compressedBytes === undefined ||
        expected.compressedBytes === size);
    if (!bounded) fail("TRANSPORT_PAYLOAD_INVALID", "length");
    let raw;
    try {
      raw = codec.gunzip(compressed, expected.uncompressedBytes);
    } catch (error) {
      fail("TRANSPORT_PAYLOAD_INVALID", "gzip");
    }
    if (raw.length !== expected.uncompressedBytes) {
      fail("TRANSPORT_PAYLOAD_INVALID", "length");
    }
    let value;
    try {
      value = JSON.parse(utf8Decode(raw));
    } catch (error) {
      fail("TRANSPORT_PAYLOAD_INVALID", "json");
    }
    if (digest(value) !== expected.canonicalDigest) {
      fail("TRANSPORT_PAYLOAD_INVALID", "digest");
    }
    return value;
  }

  /** 生成碼內嵌的 request / plan(由 Node 端完整壓縮):解回並驗 byteLength 與完整 canonical SHA。 */
  const decodeInput = (input) => decodePayload(input.base64, input);

  return { decodePayload, decodeInput };
}
