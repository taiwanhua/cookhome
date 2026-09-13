import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

/** 欄位類別(全域種子,租戶不可自訂)。 */
@Schema({ collection: "field_categories", timestamps: true })
export class FieldCategory {
  /** unique,kebab-case(如 gender、demo-category)。 */
  @Prop({ type: String, required: true })
  key!: string;

  /** 類別顯示名稱(如「性別」)。 */
  @Prop({ type: String, required: true })
  name!: string;

  /** 描述說明(選填)。 */
  @Prop({ type: String })
  description?: string;

  /** 保護種子類別。 */
  @Prop({ type: Boolean, default: false })
  isSystem!: boolean;
}

export const FieldCategorySchema =
  SchemaFactory.createForClass(FieldCategory);

FieldCategorySchema.index({ key: 1 }, { unique: true });
