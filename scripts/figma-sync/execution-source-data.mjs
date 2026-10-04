/**
 * 生成碼內的資料字面值：兩個 base64 字元以一個安全 BMP 碼元保存，減少 code 字元数。
 * 不壓縮或執行 JavaScript；runtime 還原 base64 後仍走既有 gzip / byteLength / SHA decoder。
 * U+4000..U+5080 不含 surrogate、控制字元、引號、反斜線或 JS 行分隔字元。
 * 外部 request / plan / envelope 的格式完全不變。
 */
export function packBase64Literal(base64) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
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
  let packed = "";
  for (let index = 0; index < base64.length; index += 2) {
    packed += String.fromCharCode(
      0x4000 +
        alphabet.indexOf(base64[index]) * 65 +
        alphabet.indexOf(base64[index + 1]),
    );
  }
  return packed;
}

/** 可獨立序列化的純資料 decoder，無 Figma / Node 或其他 module closure。 */
export function unpackBase64Literal(packed) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  const fail = () => {
    const error = new Error("EXECUTION_PAYLOAD_INVALID");
    error.name = "FigmaSyncError";
    error.code = "EXECUTION_PAYLOAD_INVALID";
    throw error;
  };
  if (typeof packed !== "string") fail();
  let base64 = "";
  for (let index = 0; index < packed.length; index += 1) {
    const value = packed.charCodeAt(index) - 0x4000;
    if (value < 0 || value >= 65 * 65) fail();
    base64 += alphabet[Math.floor(value / 65)] + alphabet[value % 65];
  }
  return base64;
}
