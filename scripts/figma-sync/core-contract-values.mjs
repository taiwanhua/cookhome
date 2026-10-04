/**
 * 協定的基本值運算:canonical JSON + 純 JS SHA-256、UTF-8 byte 計數與容差比較;每個 operation 的生成碼都需要。
 * slot / 資產索引與 scope guards、規劃用的 alias 解析在 core-contract-guards.mjs,只由需要的 operation 組裝。
 * 無 Node / Figma import;會被序列化進 Figma 執行,依賴只來自函式內部。
 */
export function createContractValues() {
  const ROLES = ["lighter", "light", "main", "dark", "darker", "contrast"];
  const SHADOW_ROLE = "primary-shadow";
  const TOLERANCE = 1e-6;

  /** 錯誤一律帶固定 code;detail 只放協定欄位路徑或已驗識別,不放使用者原文。 */
  function fail(code, detail) {
    const error = new Error(detail ? `${code}:${detail}` : code);
    error.name = "FigmaSyncError";
    error.code = code;
    throw error;
  }

  const isObject = (value) =>
    Object.prototype.toString.call(value) === "[object Object]";
  const has = (object, name) =>
    Object.prototype.hasOwnProperty.call(object, name);

  /** object keys 依 UTF-16 code unit 排序(預設 sort)、array 保留順序;拒絕非 JSON 值。 */
  function canonicalJson(value) {
    if (value === null || typeof value === "boolean") return String(value);
    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number") {
      if (!Number.isFinite(value)) fail("NON_JSON_VALUE", "非有限數值");
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
    }
    if (!isObject(value)) fail("NON_JSON_VALUE", "非 JSON 型別");
    const members = Object.keys(value)
      .sort()
      .map((name) => `${JSON.stringify(name)}:${canonicalJson(value[name])}`);
    return `{${members.join(",")}}`;
  }

  // prettier-ignore
  const SHA_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  /** 把字串逐 byte(UTF-8;孤立 surrogate 同 Node 編為 U+FFFD)交給 push,回傳 byte 數。 */
  function eachUtf8Byte(text, push) {
    let total = 0;
    const emit = (byte) => {
      total += 1;
      if (push) push(byte);
    };
    for (let i = 0; i < text.length; i += 1) {
      let code = text.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
        const next = text.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
          i += 1;
        }
      }
      if (code >= 0xd800 && code <= 0xdfff) code = 0xfffd;
      if (code < 0x80) emit(code);
      else if (code < 0x800) {
        emit(0xc0 | (code >> 6));
        emit(0x80 | (code & 63));
      } else if (code < 0x10000) {
        emit(0xe0 | (code >> 12));
        emit(0x80 | ((code >> 6) & 63));
        emit(0x80 | (code & 63));
      } else {
        emit(0xf0 | (code >> 18));
        emit(0x80 | ((code >> 12) & 63));
        emit(0x80 | ((code >> 6) & 63));
        emit(0x80 | (code & 63));
      }
    }
    return total;
  }
  const utf8Length = (text) => eachUtf8Byte(text, null);

  /** 純 JS 的 SHA-256;Figma 端沒有 Node 的 crypto 模組。 */
  function sha256Hex(text) {
    const state = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
      0x1f83d9ab, 0x5be0cd19,
    ]);
    const block = new Uint8Array(64);
    const words = new Uint32Array(64);
    let used = 0;
    const rotate = (value, bits) => (value >>> bits) | (value << (32 - bits));
    const compress = () => {
      for (let i = 0; i < 16; i += 1) {
        words[i] =
          (block[i * 4] << 24) |
          (block[i * 4 + 1] << 16) |
          (block[i * 4 + 2] << 8) |
          block[i * 4 + 3];
      }
      for (let i = 16; i < 64; i += 1) {
        const a = words[i - 15];
        const b = words[i - 2];
        const s0 = rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3);
        const s1 = rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10);
        words[i] = (words[i - 16] + s0 + words[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = state;
      for (let i = 0; i < 64; i += 1) {
        const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
        const t1 = (h + s1 + ((e & f) ^ (~e & g)) + SHA_K[i] + words[i]) | 0;
        const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
        const t2 = (s0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g;
        g = f;
        f = e;
        e = (d + t1) | 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) | 0;
      }
      [a, b, c, d, e, f, g, h].forEach((value, i) => {
        state[i] = (state[i] + value) | 0;
      });
    };
    const push = (byte) => {
      block[used] = byte;
      used += 1;
      if (used === 64) {
        compress();
        used = 0;
      }
    };
    const total = eachUtf8Byte(text, push);
    const high = Math.floor((total * 8) / 0x100000000);
    const low = (total * 8) % 0x100000000;
    push(0x80);
    while (used !== 56) push(0);
    for (const part of [high, low]) {
      for (let shift = 24; shift >= 0; shift -= 8) {
        push((part >>> shift) & 255);
      }
    }
    return Array.from(state, (value) =>
      value.toString(16).padStart(8, "0"),
    ).join("");
  }

  const digest = (value) => sha256Hex(canonicalJson(value));

  /** 深比較;數值容差固定 1e-6(色彩、陰影幾何不能只比 HEX)。 */
  function sameValue(a, b) {
    if (typeof a === "number" && typeof b === "number") {
      return Math.abs(a - b) <= TOLERANCE;
    }
    if (a === null || b === null || typeof a !== "object") return a === b;
    if (typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) {
      return false;
    }
    const names = Object.keys(a);
    return (
      names.length === Object.keys(b).length &&
      names.every((name) => has(b, name) && sameValue(a[name], b[name]))
    );
  }

  return {
    ROLES,
    SHADOW_ROLE,
    fail,
    isObject,
    has,
    canonicalJson,
    eachUtf8Byte,
    utf8Length,
    digest,
    sameValue,
  };
}
