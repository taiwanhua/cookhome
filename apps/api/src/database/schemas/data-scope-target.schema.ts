import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema } from "mongoose";

import { baseFieldsPlugin } from "../plugins/base-fields.plugin";

/**
 * 資料範圍目標(全表種子資料,ADR-0008):「資料範圍」頁左側清單來源,**一列 = 一個模組**。
 * 識別鍵是 `(collection, moduleKey)`:同一張表(如所有表單模組共用的 `form_submissions`)
 * 可以有多個模組各自一個目標、各自一份規則。
 */
// `collection` 為 base-schema 指定的欄位名;Mongoose 視其為保留字,明確放行
@Schema({
  collection: "data_scope_targets",
  timestamps: true,
  suppressReservedKeysWarning: true,
})
export class DataScopeTarget {
  /** 資料所在的 collection(如 `demo_items_one`);與 `moduleKey` 合為唯一鍵。 */
  @Prop({ type: String, required: true })
  collection!: string;

  /** 宣告這個目標的模組 key(seed runner 填宣告檔所在模組;如 `demo.sub.sample-one`)。 */
  @Prop({ type: String, required: true })
  moduleKey!: string;

  /** 中文名(頁面顯示)。 */
  @Prop({ type: String, required: true })
  name!: string;

  /** 說明(頁面顯示,選填)。 */
  @Prop({ type: String })
  description?: string;

  /** 可篩業務欄位目錄;基礎欄位由程式自動附加,不入庫。 */
  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  fields!: Record<string, unknown>[];

  /** 保護種子目標。 */
  @Prop({ type: Boolean, default: false })
  isSystem!: boolean;
}

// 由 class 產生 Mongoose Schema(供 MongooseModule 註冊為 model,並掛下方索引)
export const DataScopeTargetSchema =
  SchemaFactory.createForClass(DataScopeTarget);

DataScopeTargetSchema.index({ collection: 1, moduleKey: 1 }, { unique: true });
// 基礎欄位(ADR-0007);全表種子資料,不掛 tenantScope
DataScopeTargetSchema.plugin(baseFieldsPlugin);
