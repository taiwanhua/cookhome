import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

/** 示範模組2(docs/modules/demo.sample-two.md):不宣告資料範圍目標的對照組。 */
@Schema({ collection: "demo_items_two", timestamps: true })
export class DemoItemTwo {
  @Prop({ type: Types.ObjectId, required: true })
  orgId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String })
  note?: string;

  @Prop({ type: Boolean, default: true })
  enabled!: boolean;
}

export const DemoItemTwoSchema = SchemaFactory.createForClass(DemoItemTwo);

DemoItemTwoSchema.index({ orgId: 1, createdAt: 1 });
