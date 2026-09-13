import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema, Types } from "mongoose";

/** 側欄呈現型別:group(可展開)/ link / hidden(隱藏頁,key 一律 -page 結尾)。 */
export const MODULE_SIDEBAR_TYPES = ["group", "link", "hidden"] as const;

export type ModuleSidebarType = (typeof MODULE_SIDEBAR_TYPES)[number];

/** 模組(全表種子資料):樹狀,物化路徑 ancestors。模組即頁面(ADR-0004)。 */
@Schema({ collection: "modules", timestamps: true })
export class Module {
  /** unique,kebab-case。 */
  @Prop({ type: String, required: true })
  key!: string;

  /** 顯示名,與 key 分離。 */
  @Prop({ type: String, required: true })
  name!: string;

  /** 上層模組 id;頂層為 null。 */
  @Prop({ type: Types.ObjectId, default: null })
  parentId!: Types.ObjectId | null;

  /** 物化路徑祖先 id 陣列(ADR-0005)。 */
  @Prop({ type: [Types.ObjectId], default: [] })
  ancestors!: Types.ObjectId[];

  /** 只有自己那段(前綴父路由由 API 組合)。 */
  @Prop({ type: String })
  route?: string;

  /** 側欄呈現型別。 */
  @Prop({ type: String, required: true, enum: MODULE_SIDEBAR_TYPES })
  sidebarType!: ModuleSidebarType;

  /** 側欄排序。 */
  @Prop({ type: Number, default: 0 })
  order!: number;

  /** 停用連動整棵子樹。 */
  @Prop({ type: Boolean, default: true })
  enabled!: boolean;

  /** 保護種子模組(不可刪/改 key)。 */
  @Prop({ type: Boolean, default: false })
  isSystem!: boolean;

  /** 描述說明(選填)。 */
  @Prop({ type: String })
  description?: string;

  /** 受控 JSON 設定。 */
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  settings!: Record<string, unknown>;
}

// 由 class 產生 Mongoose Schema(供 MongooseModule 註冊為 model,並掛下方索引/plugin)
export const ModuleSchema = SchemaFactory.createForClass(Module);

ModuleSchema.index({ key: 1 }, { unique: true });
ModuleSchema.index({ ancestors: 1 });
