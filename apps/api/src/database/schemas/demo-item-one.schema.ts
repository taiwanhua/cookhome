import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

/** 示範模組1(docs/modules/demo.sub.sample-one.md):宣告資料範圍目標的對象。 */
@Schema({ collection: "demo_items_one", timestamps: true })
export class DemoItemOne {
  /** 資料歸屬組織(租戶隔離,ADR-0005)。 */
  @Prop({ type: Types.ObjectId, required: true })
  orgId!: Types.ObjectId;

  /** 名稱。 */
  @Prop({ type: String, required: true })
  name!: string;

  /** 分類;欄位管理「示範分類」選項(存 value)。 */
  @Prop({ type: String })
  category?: string;

  /** 備註(選填)。 */
  @Prop({ type: String })
  note?: string;

  /** 內部備註;欄位級權限控(show/edit-internal-note)。 */
  @Prop({ type: String })
  internalNote?: string;

  /** 封面圖:公開 bucket 物件路徑。 */
  @Prop({ type: String })
  coverPath?: string;

  /** 附件:私有 bucket 物件路徑。 */
  @Prop({ type: String })
  attachmentPath?: string;

  /** 啟用狀態。 */
  @Prop({ type: Boolean, default: true })
  enabled!: boolean;
}

export const DemoItemOneSchema = SchemaFactory.createForClass(DemoItemOne);

DemoItemOneSchema.index({ orgId: 1, createdAt: 1 });
