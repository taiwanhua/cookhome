import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

import type { Schema } from "mongoose";

const ALGORITHM = "aes-256-gcm";
const ENCRYPTED_PREFIX = "enc:v1:";
const IV_LENGTH = 12;

/**
 * 欄位級加密(ADR-0007):高敏個資以 AES-256-GCM 加密存放,API 預設投影不回傳。
 * 金鑰自環境變數 FIELD_ENCRYPTION_KEY 讀取(32 bytes 的 base64;雲端存 Secret Manager)。
 */
function loadKey(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY 未設定:欄位級加密欄位需要 32 bytes(base64)金鑰",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("FIELD_ENCRYPTION_KEY 長度需為 32 bytes(base64 解碼後)");
  }
  return key;
}

function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, loadKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${Buffer.concat([iv, authTag, ciphertext]).toString("base64")}`;
}

function decrypt(stored: string): string {
  const payload = Buffer.from(stored.slice(ENCRYPTED_PREFIX.length), "base64");
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = payload.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, loadKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export interface FieldEncryptionOptions {
  /** 要加密的欄位路徑(需為 String 欄位)。 */
  fields: string[];
}

/**
 * Mongoose plugin:對指定欄位做欄位級加密 + 預設投影排除(select: false)。
 * - 寫入(setter):明文 → 密文;已是密文則原樣通過(避免重複載入時二次加密)。
 * - 讀取(getter):密文 → 明文;僅在明確 `.select("+field")` 載入時才解密回傳。
 */
export function fieldEncryptionPlugin(
  schema: Schema,
  options: FieldEncryptionOptions,
): void {
  for (const field of options.fields) {
    schema.path(field).select(false);
    schema.path(field).set((value: unknown): unknown => {
      if (typeof value !== "string" || value.length === 0) {
        return value;
      }
      return value.startsWith(ENCRYPTED_PREFIX) ? value : encrypt(value);
    });
    schema.path(field).get((value: unknown): unknown => {
      if (typeof value !== "string" || !value.startsWith(ENCRYPTED_PREFIX)) {
        return value;
      }
      return decrypt(value);
    });
  }
}
