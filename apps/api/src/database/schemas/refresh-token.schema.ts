import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema, Types } from "mongoose";

/** token 所屬帳號體系(ADR-0003):user=後台使用者、customer=前台會員。 */
export const ACCOUNT_TYPES = ["user", "customer"] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** 長效 refresh token(ADR-0003):獨立 collection 存雜湊,支援輪替與登出所有裝置。 */
@Schema({ collection: "refresh_tokens", timestamps: true })
export class RefreshToken {
  /** = 帳號文件的 `_id`。 */
  @Prop({ type: Types.ObjectId, required: true })
  accountId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ACCOUNT_TYPES })
  accountType!: AccountType;

  @Prop({ type: String, required: true })
  tokenHash!: string;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ type: MongooseSchema.Types.Mixed })
  deviceInfo?: Record<string, unknown>;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

RefreshTokenSchema.index({ accountType: 1, accountId: 1 });
// TTL:到期即由 MongoDB 自動清除
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
