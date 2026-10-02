/**
 * update / migrate:down / reset 與 api 的受管定義 CLI 共用的整批互斥鎖
 * (`docs/plans/seed-migration.md`「migrate-mongo 相容、互斥與結果」)。
 *
 * 鎖是 `changelog_lock` 裡固定 `_id` 的一筆文件,以唯一的 `_id` 原子搶占、依 owner token 釋放。
 * **只有最外層命令取得與釋放**;內部步驟與 api 子程序沿用同一個 owner 只核對。
 * 沒有 TTL:程序硬中止時鎖會留著,不自動接管(原程序可能還在寫入),由操作者確認它已停止後
 * 以 `update --unlock-owner=<token>` 指名解除。migrate-mongo 自己的鎖維持停用(`lockTtl: 0`),
 * 它不會讀寫這張表。
 */
import { randomUUID } from "node:crypto";

import { type Db, MongoServerError } from "mongodb";

import {
  SEED_LOCK_COLLECTION,
  SEED_LOCK_ID,
  type SeedLockDocument,
  type SeedLockOperation,
  type SeedLockProgress,
} from "@repo/domain/seed";

/** 最外層命令持有的鎖;往下傳給每一步與 api 子程序核對。 */
export interface SeedLockHandle {
  owner: string;
  runId: string;
  operation: SeedLockOperation;
  releaseCommit: string;
}

/** 鎖在別人手上(或已不在自己手上)。此時不得再寫入。 */
export class SeedLockError extends Error {
  override name = "SeedLockError";
}

const DUPLICATE_KEY = 11_000;

function locks(database: Db) {
  return database.collection<SeedLockDocument>(SEED_LOCK_COLLECTION);
}

function describeHolder(holder: SeedLockDocument): string {
  return `owner ${holder.owner}(run ${holder.runId}、${holder.operation}、commit ${holder.releaseCommit}、開始於 ${holder.startedAt.toISOString()})`;
}

/** 目前的持鎖者;沒有人持鎖回 null(唯讀)。 */
export function currentSeedLock(
  database: Db,
): Promise<SeedLockDocument | null> {
  return locks(database).findOne({ _id: SEED_LOCK_ID });
}

/**
 * 取得整批鎖。已有人持有就丟 `SeedLockError`(列出持有者與解除方式),不等待、不接管。
 */
export async function acquireSeedLock(
  database: Db,
  request: { operation: SeedLockOperation; releaseCommit: string },
): Promise<SeedLockHandle> {
  const handle: SeedLockHandle = {
    owner: randomUUID(),
    runId: randomUUID(),
    operation: request.operation,
    releaseCommit: request.releaseCommit,
  };
  try {
    await locks(database).insertOne({
      _id: SEED_LOCK_ID,
      ...handle,
      startedAt: new Date(),
    });
    return handle;
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== DUPLICATE_KEY) {
      throw error;
    }
  }
  const holder = await currentSeedLock(database);
  throw new SeedLockError(
    holder === null
      ? "無法取得整批互斥鎖:另一個程序剛釋放,請重新執行"
      : `無法取得整批互斥鎖:目前由 ${describeHolder(holder)} 持有。` +
          `若該程序仍在執行請等它結束;確認它已停止(硬中止不會自動釋放)後,以 update --unlock-owner=${holder.owner} 解除`,
  );
}

/** 每次續步之前核對鎖還在自己手上;被解除或換手就丟 `SeedLockError`,不再往下寫。 */
export async function assertSeedLockOwner(
  database: Db,
  handle: Pick<SeedLockHandle, "owner">,
): Promise<void> {
  const holder = await currentSeedLock(database);
  if (holder === null) {
    throw new SeedLockError("整批互斥鎖已不存在(被解除):停止寫入,請重新執行");
  }
  if (holder.owner !== handle.owner) {
    throw new SeedLockError(
      `整批互斥鎖已換手,目前由 ${describeHolder(holder)} 持有:停止寫入`,
    );
  }
}

/**
 * 持鎖者把目前的階段與進度記在鎖上(依 owner 條件更新;鎖已不在自己手上就丟 `SeedLockError`,
 * 所以也兼作續步前的 owner 核對)。reset 的清除階段用:`full` 清庫時執行紀錄會被清掉,鎖不會。
 */
export async function recordSeedLockProgress(
  database: Db,
  handle: Pick<SeedLockHandle, "owner">,
  progress: Pick<SeedLockProgress, "stage" | "detail">,
): Promise<void> {
  const { matchedCount } = await locks(database).updateOne(
    { _id: SEED_LOCK_ID, owner: handle.owner },
    { $set: { progress: { ...progress, updatedAt: new Date() } } },
  );
  if (matchedCount === 0) {
    await assertSeedLockOwner(database, handle);
  }
}

/** 依 owner 釋放;鎖已不是自己的就不動它。回傳是否真的釋放了。 */
export async function releaseSeedLock(
  database: Db,
  handle: Pick<SeedLockHandle, "owner">,
): Promise<boolean> {
  const { deletedCount } = await locks(database).deleteOne({
    _id: SEED_LOCK_ID,
    owner: handle.owner,
  });
  return deletedCount === 1;
}

/**
 * 最外層命令的包裝:取得鎖 → 執行 → 無論成功或失敗都依 owner 釋放。
 * `work` 要等自己啟動的子程序都退出才回來(釋放之後不得再有寫入)。
 */
export async function withSeedLock<T>(
  database: Db,
  request: { operation: SeedLockOperation; releaseCommit: string },
  work: (handle: SeedLockHandle) => Promise<T>,
): Promise<T> {
  const handle = await acquireSeedLock(database, request);
  try {
    return await work(handle);
  } finally {
    await releaseSeedLock(database, handle);
  }
}

/**
 * 操作者指名解除硬中止留下的鎖。owner 必須與目前持有者相符;沒有鎖或 owner 不符都丟錯、不動任何東西。
 * 回傳被解除的那一筆(呼叫端記進執行紀錄)。
 */
export async function unlockSeedLock(
  database: Db,
  owner: string,
): Promise<SeedLockDocument> {
  const removed = await locks(database).findOneAndDelete({
    _id: SEED_LOCK_ID,
    owner,
  });
  if (removed !== null) {
    return removed;
  }
  const holder = await currentSeedLock(database);
  throw new SeedLockError(
    holder === null
      ? "目前沒有整批互斥鎖,不需要解除"
      : `指定的 owner 與目前持有者不符(目前是 ${describeHolder(holder)}),沒有解除任何鎖`,
  );
}
