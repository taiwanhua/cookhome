import { Schema, SchemaFactory } from "@nestjs/mongoose";

import { fieldEncryptionPlugin } from "../plugins/field-encryption.plugin";
import { ACCOUNT_ENCRYPTED_FIELDS, AccountBase } from "./account-base.schema";

/** 後台使用者(ADR-0003):所屬組織走 org_user 關聯(可多組織),不掛 orgId。 */
@Schema({ collection: "users" })
export class User extends AccountBase {}

// 由 class 產生 Mongoose Schema(供 MongooseModule 註冊為 model,並掛下方索引/plugin)
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ account: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.plugin(fieldEncryptionPlugin, { fields: ACCOUNT_ENCRYPTED_FIELDS });
