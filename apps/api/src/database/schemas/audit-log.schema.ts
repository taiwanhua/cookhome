import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema, Types } from "mongoose";

import { ACCOUNT_TYPES, type AccountType } from "./refresh-token.schema";

/** 稽核日誌(ADR-0004):只增不改,v1 僅記授權相關變更。 */
@Schema({ collection: "audit_logs", timestamps: true })
export class AuditLog {
  @Prop({ type: Types.ObjectId, required: true })
  actorId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ACCOUNT_TYPES })
  actorType!: AccountType;

  @Prop({ type: Types.ObjectId })
  orgId?: Types.ObjectId;

  @Prop({ type: String, required: true })
  action!: string;

  @Prop({ type: String })
  targetType?: string;

  @Prop({ type: Types.ObjectId })
  targetId?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.Mixed })
  before?: Record<string, unknown>;

  @Prop({ type: MongooseSchema.Types.Mixed })
  after?: Record<string, unknown>;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ orgId: 1, createdAt: 1 });
AuditLogSchema.index({ targetType: 1, targetId: 1 });
