import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema, Types } from "mongoose";

import { baseFieldsPlugin } from "../plugins/base-fields.plugin";

/**
 * 權限的來源:`seed` = 模組 seed 宣告(seed runner 同步的只有這些);
 * `dynamic` = 執行期產生(表單發布時建的欄位級權限),seed 不碰、不刪。
 */
export const PERMISSION_SOURCES = ["seed", "dynamic"] as const;

export type PermissionSource = (typeof PERMISSION_SOURCES)[number];

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

  /** 來源(見 `PERMISSION_SOURCES`);既有資料由 migration 填 `seed`。 */
  @Prop({ type: String, enum: PERMISSION_SOURCES, default: "seed" })
  source!: PermissionSource;

  /**
   * 退役時間:`dynamic` 權限在新發布的版本不再宣告時標上(矩陣不列、授不了);
   * 再次宣告時清回 null。`null` = 使用中。
   */
  @Prop({ type: Date, default: null })
  retiredAt!: Date | null;
}

// 由 class 產生 Mongoose Schema(供 MongooseModule 註冊為 model,並掛下方索引/plugin)
export const PermissionSchema = SchemaFactory.createForClass(Permission);

PermissionSchema.index({ key: 1 }, { unique: true });
PermissionSchema.index({ moduleId: 1 });
// 基礎欄位(ADR-0007);全表種子資料,不掛 tenantScope
PermissionSchema.plugin(baseFieldsPlugin);
