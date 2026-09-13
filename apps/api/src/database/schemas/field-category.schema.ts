import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

/** 欄位類別(全域種子,租戶不可自訂)。 */
@Schema({ collection: "field_categories", timestamps: true })
export class FieldCategory {
  @Prop({ type: String, required: true })
  key!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: Boolean, default: false })
  isSystem!: boolean;
}

export const FieldCategorySchema =
  SchemaFactory.createForClass(FieldCategory);

FieldCategorySchema.index({ key: 1 }, { unique: true });
