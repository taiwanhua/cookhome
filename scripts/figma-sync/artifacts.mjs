/**
 * figma-sync 的檔案層:讀寫協定 artifact、Node SHA-256、路徑驗證、原子寫入、持久 receipt 的 CAS。
 * 暫存 run 內只允許固定檔名的**首次新增**,不覆蓋既有 artifact;內容相同的重寫視為冪等。
 */
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { createContract } from "./core-contract.mjs";

const contract = createContract();
const { fail } = contract;

const KIND = "(base-library|brand-library|consumer)";
const RUN_FILES = new RegExp(
  `^(request-${KIND}-scan|inventory-${KIND}|identity-review|plan|request-apply|attempt|inventory-after|runtime-result)\\.json$`,
);
const INPUT_FILES = new RegExp(
  `^inputs/(inventory-${KIND}|identity-review|previous-receipt|resume-plan|resume-attempt)\\.json$`,
);
const SOURCE_FILES = new RegExp(
  `^(scan-${KIND}|execute|transport/(scan|apply)/read-\\d{6})\\.js$`,
);
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export const RUNS_DIR = ".artifacts/figma-sync";
export const RECEIPTS_DIR = "deploy/project/figma/receipts";

/** runId / fileKey 必須是單一路徑片段:拒絕 slash、dot segment、控制字元。 */
export function assertPathSegment(value, code) {
  if (typeof value !== "string" || !SEGMENT.test(value)) fail(code);
  return value;
}

export function hashArtifact(artifact) {
  return createHash("sha256")
    .update(contract.canonicalJson(artifact), "utf8")
    .digest("hex");
}

export function readArtifact(filePath) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    fail("ARTIFACT_UNREADABLE");
  }
  return contract.validateArtifact(parsed);
}

/** 同目錄暫存後以 hard link 落地:目標已存在時 link 失敗,不會覆蓋。回傳是否為本次新增。 */
export function writeFileOnce(target, bytes) {
  mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomBytes(6).toString("hex")}.tmp`;
  writeFileSync(temporary, bytes, { flag: "wx" });
  try {
    linkSync(temporary, target);
    return true;
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  } finally {
    unlinkSync(temporary);
  }
}

const serialize = (artifact) => `${JSON.stringify(artifact, null, 2)}\n`;

/**
 * committed receipt 會參與全 repo 的 Prettier 檢查:落地前先以 repo 現有的 Prettier 排版。
 * 空白排版不影響 canonical digest;排版後內容若不等價(或環境沒有 Prettier)就沿用未排版的 JSON。
 */
function serializeReceipt(rootDir, target, receipt) {
  const plain = serialize(receipt);
  let formatted;
  try {
    const bin = createRequire(import.meta.url).resolve(
      "prettier/bin/prettier.cjs",
    );
    const result = spawnSync(
      process.execPath,
      [bin, "--stdin-filepath", target],
      { cwd: rootDir, input: plain, encoding: "utf8" },
    );
    formatted = result.status === 0 ? result.stdout : "";
    if (hashArtifact(JSON.parse(formatted)) !== hashArtifact(receipt)) {
      return plain;
    }
  } catch {
    return plain;
  }
  return formatted;
}

/** 首次寫入固定檔名;已存在時內容(canonical)必須相同,否則 ARTIFACT_EXISTS。 */
export function writeArtifact({ runDir, name, artifact }) {
  if (!RUN_FILES.test(name) && !INPUT_FILES.test(name)) {
    fail("ARTIFACT_NAME_INVALID");
  }
  contract.validateArtifact(artifact);
  const target = path.join(runDir, name);
  const digest = hashArtifact(artifact);
  if (!writeFileOnce(target, serialize(artifact))) {
    if (hashArtifact(readArtifact(target)) !== digest) {
      fail("ARTIFACT_EXISTS", name);
    }
  }
  return { kind: artifact.kind, path: target, digest };
}

/** 生成 JS 是傳輸產物:digest 取完整 UTF-8 bytes,不套 JSON canonicalization。 */
export function writeExecutionSource({ runDir, name, source }) {
  if (!SOURCE_FILES.test(name)) fail("ARTIFACT_NAME_INVALID");
  const target = path.join(runDir, name);
  const bytes = Buffer.from(source, "utf8");
  if (!writeFileOnce(target, bytes) && !readFileSync(target).equals(bytes)) {
    fail("ARTIFACT_EXISTS", name);
  }
  return {
    kind: "execution-source",
    path: target,
    digest: createHash("sha256").update(bytes).digest("hex"),
  };
}

export function receiptPath(rootDir, fileKey) {
  assertPathSegment(fileKey, "FILE_KEY_INVALID");
  return path.join(rootDir, RECEIPTS_DIR, `${fileKey}.json`);
}

const sameOwner = (receipt, project, fileKey) =>
  receipt.kind === "receipt" &&
  receipt.targetFileKey === fileKey &&
  receipt.project.repository === project.repository &&
  receipt.project.slug === project.slug;

/**
 * 讀目前 repo 對應 fileKey 的成功 receipt;沒有回 null。
 * repository / slug / targetFileKey 不符(隨底座複製而來的他專案狀態)一律拒絕,不認養。
 */
export function readReceipt({ rootDir, fileKey, project }) {
  const target = receiptPath(rootDir, fileKey);
  if (!existsSync(target)) return null;
  const receipt = readArtifact(target);
  if (!sameOwner(receipt, project, fileKey)) fail("RECEIPT_FOREIGN");
  return receipt;
}

/**
 * 同一 target 的跨程序互斥:以 exclusive create 取得鎖檔(內容記本次操作識別),finally 只釋放本次持有的鎖。
 * 鎖已存在回 RECEIPT_BUSY;不靠時間或 PID 猜測自動清除,中斷留下的鎖由操作者確認沒有 writer 後移除。
 */
function withReceiptLock(target, action) {
  mkdirSync(path.dirname(target), { recursive: true });
  const lock = `${target}.lock`;
  const token = randomBytes(12).toString("hex");
  const owner = JSON.stringify({ token, pid: process.pid });
  try {
    writeFileSync(lock, owner, { flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") fail("RECEIPT_BUSY");
    throw error;
  }
  try {
    return action();
  } finally {
    try {
      if (readFileSync(lock, "utf8") === owner) unlinkSync(lock);
    } catch {
      // 鎖已不在或不是本次持有的:不動它
    }
  }
}

/**
 * 持久 receipt 的 compare-and-swap:在鎖內重新讀磁碟現值、比對 expectedPreviousDigest、再原子 rename。
 * 只有原子 rename 不構成 CAS。已等於本次結果 → 冪等完成;已變成其他結果 → RECEIPT_CHANGED,不覆蓋、不回退。
 */
export function writeVerifiedReceipt({
  rootDir,
  receipt,
  expectedPreviousDigest,
}) {
  contract.validateArtifact(receipt);
  if (receipt.kind !== "receipt") fail("ARTIFACT_KIND_MISMATCH", "receipt");
  if (receipt.previousReceiptDigest !== expectedPreviousDigest) {
    fail("RECEIPT_CHANGED");
  }
  const target = receiptPath(rootDir, receipt.targetFileKey);
  const digest = hashArtifact(receipt);
  const done = (written) => ({
    kind: "receipt",
    path: target,
    digest,
    written,
  });
  return withReceiptLock(target, () => {
    if (!existsSync(target)) {
      // 無 previous 時檔案必須不存在;聲稱有 previous 卻沒有檔案也是變動
      if (expectedPreviousDigest !== null) fail("RECEIPT_CHANGED");
      const text = serializeReceipt(rootDir, target, receipt);
      if (!writeFileOnce(target, text)) fail("RECEIPT_CHANGED");
      return done(true);
    }
    const current = readArtifact(target);
    if (!sameOwner(current, receipt.project, receipt.targetFileKey)) {
      fail("RECEIPT_FOREIGN");
    }
    const currentDigest = hashArtifact(current);
    if (currentDigest === digest) return done(false);
    if (currentDigest !== expectedPreviousDigest) fail("RECEIPT_CHANGED");
    const temporary = `${target}.${randomBytes(6).toString("hex")}.tmp`;
    writeFileSync(temporary, serializeReceipt(rootDir, target, receipt), {
      flag: "wx",
    });
    renameSync(temporary, target);
    return done(true);
  });
}
