import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

import { baseFieldsPlugin } from "../plugins/base-fields.plugin";
import { tenantScopePlugin } from "../plugins/tenant-scope.plugin";

/** 示範模組2(docs/modules/demo.sample-two.md):不宣告資料範圍目標的對照組。 */
@Schema({ collection: "demo_items_two", timestamps: true })
export class DemoItemTwo {
  /** 資料歸屬組織(租戶隔離,ADR-0005)。 */
  @Prop({ type: Types.ObjectId, required: true })
  orgId!: Types.ObjectId;

  /** 名稱。 */
  @Prop({ type: String, required: true })
  name!: string;

  /** 備註(選填)。 */
  @Prop({ type: String })
  note?: string;

  /** 啟用狀態。 */
  @Prop({ type: Boolean, default: true })
  enabled!: boolean;
}

// 由 class 產生 Mongoose Schema(供 MongooseModule 註冊為 model,並掛下方索引)
export const DemoItemTwoSchema = SchemaFactory.createForClass(DemoItemTwo);

DemoItemTwoSchema.index({ orgId: 1, createdAt: 1 });
// 基礎欄位(ADR-0007)+ 租戶資料:查詢自動限縮在操作者可見組織內(ADR-0005)
DemoItemTwoSchema.plugin(baseFieldsPlugin);
DemoItemTwoSchema.plugin(tenantScopePlugin);
