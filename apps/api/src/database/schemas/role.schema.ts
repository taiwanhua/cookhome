import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema } from "mongoose";

/** 角色(ADR-0004):擁有組織走 org_role 關聯;種子角色以 key 冪等。 */
@Schema({ collection: "roles", timestamps: true })
export class Role {
  /** 種子角色用(如 super-admin);租戶自建可空。 */
  @Prop({ type: String })
  key?: string;

  /** 角色顯示名稱。 */
  @Prop({ type: String, required: true })
  name!: string;

  /** 描述說明(選填)。 */
  @Prop({ type: String })
  description?: string;

  /** 停用。 */
  @Prop({ type: Boolean, default: true })
  enabled!: boolean;

  /** 保護種子角色。 */
  @Prop({ type: Boolean, default: false })
  isSystem!: boolean;

  /** 受控 JSON 設定。 */
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  settings!: Record<string, unknown>;
}

// 由 class 產生 Mongoose Schema(供 MongooseModule 註冊為 model,並掛下方索引/plugin)
export const RoleSchema = SchemaFactory.createForClass(Role);

RoleSchema.index({ key: 1 }, { unique: true, sparse: true });
