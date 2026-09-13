import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

/** 欄位選項(ADR-0005):orgId null=全域種子、有值=租戶自訂;下架不刪。 */
@Schema({ collection: "fields", timestamps: true })
export class Field {
  @Prop({ type: Types.ObjectId, required: true })
  categoryId!: Types.ObjectId;

  /** null=全域種子;有值=租戶自訂。 */
  @Prop({ type: Types.ObjectId, default: null })
  orgId!: Types.ObjectId | null;

  @Prop({ type: String, required: true })
  label!: string;

  @Prop({ type: String, required: true })
  value!: string;

  @Prop({ type: Number, default: 0 })
  order!: number;

  @Prop({ type: Boolean, default: true })
  enabled!: boolean;

  @Prop({ type: Boolean, default: false })
  isSystem!: boolean;

  @Prop({ type: String })
  description?: string;
}

export const FieldSchema = SchemaFactory.createForClass(Field);

FieldSchema.index({ categoryId: 1, orgId: 1 });
