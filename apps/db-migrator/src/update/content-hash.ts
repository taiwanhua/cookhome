/**
 * update 用到的雜湊:來源檔內容、定義宣告的兩個 hash、計畫 hash。格式一律 `sha256:<64 位小寫十六進位>`
 * (與 `@repo/domain/seed` 的 `SEED_HASH_PATTERN` 相同)。
 */
import { createHash } from "node:crypto";

import {
  type DefinitionSeedHashes,
  type DefinitionSeedSet,
  SEED_HASH_ALGORITHM,
  hashDefinitionSeed,
} from "@repo/domain/seed";

export function sha256Hex(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

/** 一段內容(檔案位元組或正規化字串)的 hash。 */
export function contentHashOf(content: string | Uint8Array): string {
  return `${SEED_HASH_ALGORITHM}:${sha256Hex(content)}`;
}

/**
 * 來源檔(migration、快照)的 hash。換行先統一成 LF:同一個 commit 在不同平台 checkout 出來的
 * 換行可能不同,續跑的來源比對不該因此判成「檔案被改過」。
 */
export function sourceFileHashOf(content: Uint8Array): string {
  return contentHashOf(
    Buffer.from(content).toString("utf8").replaceAll("\r\n", "\n"),
  );
}

/** 一份定義宣告的 contentHash / snapshotHash(與 api 那一端同一套正規化)。 */
export function definitionHashesOf(
  seed: DefinitionSeedSet,
): DefinitionSeedHashes {
  return hashDefinitionSeed(seed, (text) => sha256Hex(text));
}

function compareKeys(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

/**
 * 鍵序固定的 JSON(計畫 hash 用)。普通種子的 `data` 不保證是純 JSON(可能有 Date),
 * 所以不借用定義的 `canonicalJson`:Date 取 ISO 字串,其餘非純值只記型別。
 */
export function stableStringify(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    // undefined、非有限數字、bigint、函式…:不是純 JSON,只記它的型別
    return JSON.stringify(`<${typeof value}>`);
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .toSorted(compareKeys)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
