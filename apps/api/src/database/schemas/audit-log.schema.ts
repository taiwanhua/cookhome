import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema, Types } from "mongoose";

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

  /** 動作發生的組織脈絡(選填)。 */
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

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ orgId: 1, createdAt: 1 });
AuditLogSchema.index({ targetType: 1, targetId: 1 });
