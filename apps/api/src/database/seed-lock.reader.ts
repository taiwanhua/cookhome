/* eslint-disable @repo/no-raw-model-query -- 共用互斥鎖不是租戶資料(沒有操作者、基礎欄位與可見範圍),且由 db-migrator 以原生驅動程式寫入;此檔是它在 api 的唯一出口,只讀固定 `_id` 的那一筆;到期條件:無 */
import type { Model } from "mongoose";

import { SEED_LOCK_ID } from "@repo/domain/seed";

import type { SeedLock } from "./schemas/seed-lock.schema";

/** 目前持鎖者(只有核對與訊息要用的欄位)。 */
export interface SeedLockHolder {
  owner: string;
  runId: string;
  operation: string;
}

/**
 * 讀共用互斥鎖目前的持有者(`docs/plans/seed-migration.md`「migrate-mongo 相容、互斥與結果」)。
 * **只讀**:取得、續步與釋放都在 db-migrator 的最外層命令,api 的受管定義 CLI 只核對 owner。
 */
export class SeedLockReader {
  constructor(private readonly model: Model<SeedLock>) {}

  /** 沒有人持鎖回 null。 */
  async currentHolder(): Promise<SeedLockHolder | null> {
    const lock = await this.model
      .findOne({ _id: SEED_LOCK_ID })
      .lean<SeedLock>()
      .exec();
    return lock === null
      ? null
      : { owner: lock.owner, runId: lock.runId, operation: lock.operation };
  }
}
