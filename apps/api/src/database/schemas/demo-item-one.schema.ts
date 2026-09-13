import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

/** 示範模組1(docs/modules/demo.sub.sample-one.md):宣告資料範圍目標的對象。 */
@Schema({ collection: "demo_items_one", timestamps: true })
export class DemoItemOne {
  @Prop({ type: Types.ObjectId, required: true })
  orgId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  name!: string;

  /** 欄位管理「示範分類」選項(存 value)。 */
  @Prop({ type: String })
  category?: string;

  @Prop({ type: String })
  note?: string;

  /** 欄位級權限控。 */
  @Prop({ type: String })
  internalNote?: string;

  /** 公開 bucket 物件路徑。 */
  @Prop({ type: String })
  coverPath?: string;

  /** 私有 bucket 物件路徑。 */
  @Prop({ type: String })
  attachmentPath?: string;

  @Prop({ type: Boolean, default: true })
  enabled!: boolean;
}

export const DemoItemOneSchema = SchemaFactory.createForClass(DemoItemOne);

DemoItemOneSchema.index({ orgId: 1, createdAt: 1 });
