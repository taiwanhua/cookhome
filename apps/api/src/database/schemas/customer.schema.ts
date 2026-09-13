import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

import { fieldEncryptionPlugin } from "../plugins/field-encryption.plugin";
import { ACCOUNT_ENCRYPTED_FIELDS, AccountBase } from "./account-base.schema";

/** 前台會員(ADR-0003):單一歸屬組織 — 註冊預設根組織、可指定為某租戶。 */
@Schema({ collection: "customers" })
export class Customer extends AccountBase {
  /** 歸屬組織;註冊預設根組織,可指定為某租戶的會員(ADR-0005)。 */
  @Prop({ type: Types.ObjectId, required: true })
  orgId!: Types.ObjectId;
}

// 由 class 產生 Mongoose Schema(供 MongooseModule 註冊為 model,並掛下方索引/plugin)
export const CustomerSchema = SchemaFactory.createForClass(Customer);

CustomerSchema.index({ account: 1 }, { unique: true });
CustomerSchema.index({ email: 1 }, { unique: true });
CustomerSchema.index({ orgId: 1, createdAt: 1 });
CustomerSchema.plugin(fieldEncryptionPlugin, {
  fields: ACCOUNT_ENCRYPTED_FIELDS,
});
