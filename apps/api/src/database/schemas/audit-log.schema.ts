/* eslint-disable unicorn/no-this-outside-of-class -- Mongoose 中介層以 this 接收 Document,無參數式替代;到期條件:Mongoose 提供以參數傳入的中介層 API */
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import {
  type MongooseQueryMiddleware,
  Schema as MongooseSchema,
  Types,
} from "mongoose";

import { baseFieldsPlugin } from "../plugins/base-fields.plugin";
import { tenantScopePlugin } from "../plugins/tenant-scope.plugin";
import { ACCOUNT_TYPES, type AccountType } from "./refresh-token.schema";

/** 稽核日誌(ADR-0004):只增不改,v1 僅記授權相關變更。 */
@Schema({ collection: "audit_logs", timestamps: true })
export class AuditLog {
  /** 執行動作者的帳號 id。 */
  @Prop({ type: Types.ObjectId, required: true })
  actorId!: Types.ObjectId;

  /** 執行者帳號體系:user / customer。 */
  @Prop({ type: String, required: true, enum: ACCOUNT_TYPES })
  actorType!: AccountType;

  /** 動作發生的組織脈絡 = 操作者當前組織;型別選填但 tenantScopePlugin(allowGlobal: false)實質必填,沒有當前組織的操作者寫不進來。 */
  @Prop({ type: Types.ObjectId })
  orgId?: Types.ObjectId;

  /** 動作名稱(如 grant-role、revoke-role)。 */
  @Prop({ type: String, required: true })
  action!: string;

  /** 被操作對象的類型(如 user_role,選填)。 */
  @Prop({ type: String })
  targetType?: string;

  /** 被操作對象的 id(選填)。 */
  @Prop({ type: Types.ObjectId })
  targetId?: Types.ObjectId;

  /** 變更前值(選填)。 */
  @Prop({ type: MongooseSchema.Types.Mixed })
  before?: Record<string, unknown>;

  /** 變更後值(選填)。 */
  @Prop({ type: MongooseSchema.Types.Mixed })
  after?: Record<string, unknown>;
}

// 由 class 產生 Mongoose Schema(供 MongooseModule 註冊為 model,並掛下方索引)
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ orgId: 1, createdAt: 1 });
AuditLogSchema.index({ targetType: 1, targetId: 1 });

/** 稽核紀錄被嘗試更新 / 刪除時拋出;屬程式錯誤(只增不改是不變量),不是使用者錯誤。 */
export class AuditLogImmutableError extends Error {
  override name = "AuditLogImmutableError";
}

/** 會改動既有文件的查詢中介層:全部封死(建立走 `save`,不在此列)。 */
const MUTATING_QUERY_MIDDLEWARE = [
  "updateOne",
  "updateMany",
  "replaceOne",
  "findOneAndUpdate",
  "findOneAndReplace",
  "findOneAndDelete",
  "deleteOne",
  "deleteMany",
] as const satisfies readonly MongooseQueryMiddleware[];

// 只增不改(ADR-0004):不變量掛在 schema 上,任何入口(含 BaseRepository 的
// updateById / updateMany / softDeleteById)都改不動已寫入的稽核紀錄;軟刪除也不行。
AuditLogSchema.pre([...MUTATING_QUERY_MIDDLEWARE], () => {
  throw new AuditLogImmutableError(
    "audit_logs 只增不改(ADR-0004):稽核紀錄不可更新或刪除",
  );
});

AuditLogSchema.pre("save", function () {
  if (!this.isNew) {
    throw new AuditLogImmutableError(
      "audit_logs 只增不改(ADR-0004):已寫入的稽核紀錄不可再存檔",
    );
  }
});

// 基礎欄位(ADR-0007)+ 動作發生的組織脈絡 = 租戶資料:查詢限縮在操作者可見組織內(ADR-0005)
AuditLogSchema.plugin(baseFieldsPlugin);
AuditLogSchema.plugin(tenantScopePlugin);
