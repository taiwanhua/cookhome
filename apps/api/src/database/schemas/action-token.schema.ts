import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

/** 單次動作 token 類型(ADR-0009/0010)。 */
export const ACTION_TOKEN_TYPES = ["activation", "password-reset"] as const;

export type ActionTokenType = (typeof ACTION_TOKEN_TYPES)[number];

/** 單次使用的動作 token(啟用信、密碼重設)。 */
@Schema({ collection: "action_tokens", timestamps: true })
export class ActionToken {
  /** 對應的使用者 id。 */
  @Prop({ type: Types.ObjectId, required: true })
  userId!: Types.ObjectId;

  /** token 用途:activation(啟用)/ password-reset(重設)。 */
  @Prop({ type: String, required: true, enum: ACTION_TOKEN_TYPES })
  type!: ActionTokenType;

  /** token 雜湊(不存明碼)。 */
  @Prop({ type: String, required: true })
  tokenHash!: string;

  /** TTL index;啟用 7 天、重設 30 分鐘(env 可調),過期自動清除。 */
  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  /** 已使用時間;null 表示尚未使用(單次使用判斷)。 */
  @Prop({ type: Date, default: null })
  usedAt!: Date | null;
}

// 由 class 產生 Mongoose Schema(供 MongooseModule 註冊為 model,並掛下方索引)
export const ActionTokenSchema = SchemaFactory.createForClass(ActionToken);

ActionTokenSchema.index({ userId: 1 });
ActionTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
