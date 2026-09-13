import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

/** 欄位選項(ADR-0005):orgId null=全域種子、有值=租戶自訂;下架不刪。 */
@Schema({ collection: "fields", timestamps: true })
export class Field {
  /** 所屬欄位類別 id。 */
  @Prop({ type: Types.ObjectId, required: true })
  categoryId!: Types.ObjectId;

  /** null=全域種子;有值=租戶自訂。 */
  @Prop({ type: Types.ObjectId, default: null })
  orgId!: Types.ObjectId | null;

  /** 顯示名稱(如「男」)。 */
  @Prop({ type: String, required: true })
  label!: string;

  /** 儲存值(如「male」)。 */
  @Prop({ type: String, required: true })
  value!: string;

  /** 下拉排序。 */
  @Prop({ type: Number, default: 0 })
  order!: number;

  /** 停用即新填寫不再出現(既有資料不受影響)。 */
  @Prop({ type: Boolean, default: true })
  enabled!: boolean;

  /** 保護種子選項。 */
  @Prop({ type: Boolean, default: false })
  isSystem!: boolean;

  /** 描述說明(選填)。 */
  @Prop({ type: String })
  description?: string;
}

export const FieldSchema = SchemaFactory.createForClass(Field);

FieldSchema.index({ categoryId: 1, orgId: 1 });
