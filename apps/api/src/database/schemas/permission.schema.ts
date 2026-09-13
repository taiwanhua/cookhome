import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema, Types } from "mongoose";

/** 權限(全表種子資料,ADR-0004):key = 擁有模組key.動作。 */
@Schema({ collection: "permissions", timestamps: true })
export class Permission {
  /** unique,`擁有模組key.動作`(全 kebab-case)。 */
  @Prop({ type: String, required: true })
  key!: string;

  /** 擁有模組(固定從屬用直接欄位,ADR-0001/0004)。 */
  @Prop({ type: Types.ObjectId, required: true })
  moduleId!: Types.ObjectId;

  /** 顯示名(矩陣與權限清單)。 */
  @Prop({ type: String, required: true })
  name!: string;

  /** 補充說明(矩陣 hover / 權限清單)。 */
  @Prop({ type: String })
  description?: string;

  /** 全域 kill switch。 */
  @Prop({ type: Boolean, default: true })
  enabled!: boolean;

  /** 保護種子權限。 */
  @Prop({ type: Boolean, default: false })
  isSystem!: boolean;

  /** 受控 JSON 設定。 */
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  settings!: Record<string, unknown>;
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);

PermissionSchema.index({ key: 1 }, { unique: true });
PermissionSchema.index({ moduleId: 1 });
