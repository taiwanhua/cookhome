import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema } from "mongoose";

/** 命中規則的頂層合成方式(預設 OR)。 */
export const DATA_SCOPE_COMBINE_OPS = ["AND", "OR"] as const;

export type DataScopeCombineOp = (typeof DATA_SCOPE_COMBINE_OPS)[number];

/** 資料範圍規則(ADR-0008):本段僅 collection 就位,執行屬第 4 段。 */
// `collection` 為 base-schema 指定的欄位名(資料目標);Mongoose 視其為保留字,明確放行
@Schema({
  collection: "data_scope_rules",
  timestamps: true,
  suppressReservedKeysWarning: true,
})
export class DataScopeRule {
  /** unique,資料目標。 */
  @Prop({ type: String, required: true })
  collection!: string;

  @Prop({ type: String, enum: DATA_SCOPE_COMBINE_OPS, default: "OR" })
  combineOp!: DataScopeCombineOp;

  /** `{ audience, filter 巢狀樹 }`;結構見 base-schema。 */
  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  rules!: Record<string, unknown>[];
}

export const DataScopeRuleSchema = SchemaFactory.createForClass(DataScopeRule);

DataScopeRuleSchema.index({ collection: 1 }, { unique: true });
