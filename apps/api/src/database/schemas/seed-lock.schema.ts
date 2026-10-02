import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

import {
  SEED_LOCK_COLLECTION,
  SEED_LOCK_OPERATIONS,
  type SeedLockOperation,
} from "@repo/domain/seed";

/**
 * 共用互斥鎖的那一筆文件(`@repo/domain/seed` 的 `SeedLockDocument`;固定 `_id`)。
 *
 * 鎖放在 migrate-mongo 的 `changelog_lock`,由 db-migrator 的最外層命令以原生驅動程式取得與釋放;
 * api 只有 `SeedLockReader` 讀這一筆來核對 owner,**不經這個 model 寫入**。
 * 這不是業務資料:沒有基礎欄位、不掛 `tenantScopePlugin`、沒有索引,`_id` 是字串。
 * `autoCreate` / `autoIndex` 關閉:api 啟動時不替 migrate-mongo 建這張表或任何索引。
 */
@Schema({
  collection: SEED_LOCK_COLLECTION,
  versionKey: false,
  autoCreate: false,
  autoIndex: false,
})
export class SeedLock {
  @Prop({ type: String, required: true })
  _id!: string;

  /** owner token:每次最外層命令產生一個,續步與釋放都以它核對。 */
  @Prop({ type: String, required: true })
  owner!: string;

  @Prop({ type: String, required: true })
  runId!: string;

  @Prop({ type: String, required: true, enum: SEED_LOCK_OPERATIONS })
  operation!: SeedLockOperation;

  @Prop({ type: String, required: true })
  releaseCommit!: string;

  @Prop({ type: Date, required: true })
  startedAt!: Date;
}

// 由 class 產生 Mongoose Schema(供 MongooseModule 註冊為 model;沒有索引)
export const SeedLockSchema = SchemaFactory.createForClass(SeedLock);
