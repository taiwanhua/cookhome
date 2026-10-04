/**
 * 生成碼內的資料字面值：每個安全 BMP 碼元保存 15 bits，減少 code 字元數。
 * 不壓縮或執行 JavaScript；runtime 還原 base64 後仍走既有 gzip / byteLength / SHA decoder。
 * U+4000..U+BFFF 不含 surrogate、控制字元、引號、反斜線或 JS 行分隔字元。
 * 外部 request / plan / envelope 的格式完全不變。
 */
export function packBase64Literal(base64) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  if (
    typeof base64 !== "string" ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      base64,
    )
  ) {
    const error = new Error("EXECUTION_PAYLOAD_INVALID");
    error.name = "FigmaSyncError";
    error.code = "EXECUTION_PAYLOAD_INVALID";
    throw error;
  }
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const data = base64.slice(0, base64.length - padding);
  const tail = (15 - ((data.length * 6) % 15)) % 15;
  // 第一碼元保存 base64 的 = 數量與最後碼元補零的 bits；其餘保留所有原始 6-bit 字元。
  let packed = String.fromCharCode(0x4000 + padding * 16 + tail);
  let bits = 0;
  let buffer = 0;
  for (const character of data) {
    buffer = (buffer << 6) | alphabet.indexOf(character);
    bits += 6;
    if (bits >= 15) {
      bits -= 15;
      packed += String.fromCharCode(0x4000 + ((buffer >>> bits) & 32767));
      buffer &= (1 << bits) - 1;
    }
  }
  if (bits) packed += String.fromCharCode(0x4000 + (buffer << (15 - bits)));
  return packed;
}

/** 可獨立序列化的純資料 decoder，無 Figma / Node 或其他 module closure。 */
export function unpackBase64Literal(packed) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const fail = () => {
    const error = new Error("EXECUTION_PAYLOAD_INVALID");
    error.name = "FigmaSyncError";
    error.code = "EXECUTION_PAYLOAD_INVALID";
    throw error;
  };
  if (typeof packed !== "string" || !packed.length) fail();
  const header = packed.charCodeAt(0) - 0x4000;
  const padding = header >>> 4;
  const tail = header & 15;
  if (
    header < 0 ||
    padding > 2 ||
    tail > 14 ||
    ((packed.length - 1) * 15 - tail) % 6 !== 0
  )
    fail();
  let base64 = "";
  let bits = 0;
  let buffer = 0;
  for (let index = 1; index < packed.length; index += 1) {
    const value = packed.charCodeAt(index) - 0x4000;
    if (value < 0 || value > 32767) fail();
    // 每輪最多保留 5 bits，再讀 15 bits；不會超過位元運算的 32-bit 範圍。
    buffer = (buffer << 15) | value;
    bits += 15;
    if (index === packed.length - 1 && tail) {
      if ((buffer & ((1 << tail) - 1)) !== 0) fail();
      buffer >>>= tail;
      bits -= tail;
    }
    while (bits >= 6) {
      bits -= 6;
      base64 += alphabet[(buffer >>> bits) & 63];
      buffer &= (1 << bits) - 1;
    }
  }
  if (bits !== 0 || (!base64.length && (tail || padding))) fail();
  base64 += "=".repeat(padding);
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      base64,
    )
  )
    fail();
  return base64;
}
