import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema } from "mongoose";

/** 資料範圍目標(全表種子資料,ADR-0008):「資料範圍」頁左側清單來源。 */
// `collection` 為 base-schema 指定的欄位名;Mongoose 視其為保留字,明確放行
@Schema({
  collection: "data_scope_targets",
  timestamps: true,
  suppressReservedKeysWarning: true,
})
export class DataScopeTarget {
  /** unique(如 `demo_items_one`)。 */
  @Prop({ type: String, required: true })
  collection!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String })
  description?: string;

  /** 可篩業務欄位目錄;基礎欄位由程式自動附加,不入庫。 */
  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  fields!: Record<string, unknown>[];

  @Prop({ type: Boolean, default: false })
  isSystem!: boolean;
}

export const DataScopeTargetSchema =
  SchemaFactory.createForClass(DataScopeTarget);

DataScopeTargetSchema.index({ collection: 1 }, { unique: true });
