import { mongo } from "mongoose";

import { conflictError } from "../forms-error";

/** 每筆提交最多幾筆修訂(Spec 6a §4 `revisions[]` 上限)。 */
export const MAX_REVISIONS = 50;

/**
 * 更新後完整文件的 BSON 位元組上限。Mongo 單筆文件硬上限是 16MB;留一半給同一次更新裡
 * 還沒算到的欄位(稽核、流程連結)與日後加欄位,超過就請使用者建新的申請而不是寫到一半失敗。
 */
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

/** 這次寫入之後的文件長相:`set` 覆寫的欄位,加上(若有)要 push 進 `revisions[]` 的那一筆快照。 */
export interface SubmissionWrite {
  set: Record<string, unknown>;
  pushRevision?: unknown;
}

/**
 * 寫入前的容量檢查(Spec 6a §4):以**更新後的完整文件**(含最新 `values`、全部 `revisions` 與
 * 這次要加的快照)估算,每次寫入前算、搭 `expectedEditVersion` 條件更新(估算與寫入之間被改了,
 * 條件更新自然不命中 → `EDIT_VERSION_MISMATCH`)。
 *
 * - 修訂筆數超過 50 → `CONFLICT`(`REVISION_LIMIT`)
 * - BSON 超過 8MB → `CONFLICT`(`DOCUMENT_TOO_LARGE`)
 */
export function assertSubmissionCapacity(
  record: { revisions: readonly unknown[] },
  write: SubmissionWrite,
): void {
  const baseRevisions = Array.isArray(write.set.revisions)
    ? (write.set.revisions as unknown[])
    : record.revisions;
  const revisions =
    write.pushRevision === undefined
      ? baseRevisions
      : [...baseRevisions, write.pushRevision];
  if (revisions.length > MAX_REVISIONS) {
    throw conflictError(
      `Submission already has ${String(baseRevisions.length)} revisions (limit ${String(MAX_REVISIONS)})`,
      "REVISION_LIMIT",
    );
  }
  const next = { ...record, ...write.set, revisions };
  const bytes = mongo.BSON.calculateObjectSize(next);
  if (bytes > MAX_DOCUMENT_BYTES) {
    throw conflictError(
      `Submission would be ${String(bytes)} bytes (limit ${String(MAX_DOCUMENT_BYTES)})`,
      "DOCUMENT_TOO_LARGE",
    );
  }
}
