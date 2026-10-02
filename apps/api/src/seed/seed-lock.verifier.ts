import { Injectable } from "@nestjs/common";

import { SeedLockReader } from "../database/seed-lock.reader";
import { SeedRequestError } from "./seed-operator.service";

/**
 * 核對共用互斥鎖的 owner(`docs/concepts/data-layer-and-isolation.md`「Migration 與設定順序」)。
 * 鎖由最外層命令(db-migrator 的 update / reset)取得與釋放;這裡**只核對**,不搶鎖、不續期、不釋放。
 */
@Injectable()
export class SeedLockVerifier {
  constructor(private readonly locks: SeedLockReader) {}

  /** 鎖存在且 owner 就是請求帶來的那一個;否則丟 `SeedRequestError`。 */
  async assertHeldBy(owner: string): Promise<void> {
    const holder = await this.locks.currentHolder();
    if (holder === null) {
      throw new SeedRequestError(
        "LOCK_NOT_HELD",
        "資料庫沒有共用互斥鎖:安裝受管定義只能由持鎖的最外層命令啟動",
      );
    }
    if (holder.owner !== owner) {
      throw new SeedRequestError(
        "LOCK_OWNER_MISMATCH",
        `共用互斥鎖目前由另一個執行持有(run ${holder.runId}、${holder.operation}),不是這次請求的 owner`,
      );
    }
  }
}
