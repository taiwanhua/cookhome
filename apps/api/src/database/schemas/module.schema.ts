import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema, Types } from "mongoose";

/** 側欄呈現型別:group(可展開)/ link / hidden(隱藏頁,key 一律 -page 結尾)。 */
export const MODULE_SIDEBAR_TYPES = ["group", "link", "hidden"] as const;

export type ModuleSidebarType = (typeof MODULE_SIDEBAR_TYPES)[number];

/** 模組(全表種子資料):樹狀,物化路徑 ancestors。 */
@Schema({ collection: "modules", timestamps: true })
export class Module {
  /** unique,kebab-case。 */
  @Prop({ type: String, required: true })
  key!: string;

  /** 顯示名,與 key 分離。 */
  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: Types.ObjectId, default: null })
  parentId!: Types.ObjectId | null;

  @Prop({ type: [Types.ObjectId], default: [] })
  ancestors!: Types.ObjectId[];

  /** 只有自己那段(前綴父路由由 API 組合)。 */
  @Prop({ type: String })
  route?: string;

  @Prop({ type: String, required: true, enum: MODULE_SIDEBAR_TYPES })
  sidebarType!: ModuleSidebarType;

  /** 側欄排序。 */
  @Prop({ type: Number, default: 0 })
  order!: number;

  /** 停用連動整棵子樹。 */
  @Prop({ type: Boolean, default: true })
  enabled!: boolean;

  @Prop({ type: Boolean, default: false })
  isSystem!: boolean;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  settings!: Record<string, unknown>;
}

export const ModuleSchema = SchemaFactory.createForClass(Module);

ModuleSchema.index({ key: 1 }, { unique: true });
ModuleSchema.index({ ancestors: 1 });
