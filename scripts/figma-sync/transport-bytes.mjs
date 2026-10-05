/**
 * 傳輸用的 bytes 轉換:UTF-8 與 base64,純 JS、無 Node / Figma I/O。
 * Figma 端沒有 TextEncoder / TextDecoder;fflate 0.8.3 的 strToU8 在沒有 TextEncoder 時會把 BMP 以外的字元
 *(emoji 等 surrogate pair)編錯,所以 UTF-8 一律走這裡,結果與 Node 的 Buffer 逐 byte 相同。
 * 會被序列化進 Figma 執行。
 */
export function createByteCodec(contract) {
  const { fail } = contract;
  const ALPHABET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  /** 字串 → UTF-8 bytes(孤立 surrogate 同 Node 編為 U+FFFD)。 */
  function utf8Encode(text) {
    const bytes = new Uint8Array(contract.utf8Length(text));
    let at = 0;
    contract.eachUtf8Byte(text, (byte) => {
      bytes[at] = byte;
      at += 1;
    });
    return bytes;
  }

  /** UTF-8 bytes → 字串;不合法的序列直接失敗,不以替代字元掩蓋。 */
  function utf8Decode(bytes) {
    const parts = [];
    let units = [];
    const flush = () => {
      parts.push(String.fromCharCode.apply(null, units));
      units = [];
    };
    for (let i = 0; i < bytes.length;) {
      const lead = bytes[i];
      const extra = lead < 0x80 ? 0 : lead < 0xe0 ? 1 : lead < 0xf0 ? 2 : 3;
      let code =
        extra === 0 ? lead : lead & (extra === 1 ? 31 : extra === 2 ? 15 : 7);
      const valid =
        (lead < 0x80 || (lead >= 0xc2 && lead <= 0xf4)) &&
        i + extra < bytes.length;
      if (!valid) fail("TRANSPORT_PAYLOAD_INVALID", "utf8");
      for (let n = 1; n <= extra; n += 1) {
        const next = bytes[i + n];
        if ((next & 0xc0) !== 0x80) fail("TRANSPORT_PAYLOAD_INVALID", "utf8");
        code = (code << 6) | (next & 63);
      }
      // overlong(如 E0 80 80)、surrogate code point(ED A0 80)與超出 U+10FFFF(F4 90 80 80)都不是合法 UTF-8
      const shortest =
        extra === 0 ? 0 : extra === 1 ? 0x80 : extra === 2 ? 0x800 : 0x10000;
      const scalar =
        code >= shortest &&
        code <= 0x10ffff &&
        (code < 0xd800 || code > 0xdfff);
      if (!scalar) fail("TRANSPORT_PAYLOAD_INVALID", "utf8");
      i += extra + 1;
      if (code >= 0x10000) {
        const offset = code - 0x10000;
        units.push(0xd800 | (offset >> 10), 0xdc00 | (offset & 1023));
      } else {
        units.push(code);
      }
      if (units.length >= 8192) flush();
    }
    flush();
    return parts.join("");
  }

  function toBase64(bytes) {
    const parts = [];
    let text = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i];
      const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
      const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
      text += ALPHABET[a >> 2] + ALPHABET[((a & 3) << 4) | (b >> 4)];
      text += i + 1 < bytes.length ? ALPHABET[((b & 15) << 2) | (c >> 6)] : "=";
      text += i + 2 < bytes.length ? ALPHABET[c & 63] : "=";
      if (text.length >= 8192) {
        parts.push(text);
        text = "";
      }
    }
    parts.push(text);
    return parts.join("");
  }

  function fromBase64(text) {
    if (text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) {
      fail("TRANSPORT_PAYLOAD_INVALID", "base64");
    }
    const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
    const bytes = new Uint8Array((text.length / 4) * 3 - padding);
    const lookup = {};
    for (let i = 0; i < ALPHABET.length; i += 1) lookup[ALPHABET[i]] = i;
    let at = 0;
    for (let i = 0; i < text.length; i += 4) {
      const quad = [0, 1, 2, 3].map((n) => lookup[text[i + n]] || 0);
      const triple = [
        (quad[0] << 2) | (quad[1] >> 4),
        ((quad[1] & 15) << 4) | (quad[2] >> 2),
        ((quad[2] & 3) << 6) | quad[3],
      ];
      for (const byte of triple) {
        if (at < bytes.length) {
          bytes[at] = byte;
          at += 1;
        }
      }
    }
    return bytes;
  }

  return { utf8Encode, utf8Decode, toBase64, fromBase64 };
}
