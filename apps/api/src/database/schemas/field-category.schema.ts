import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

import { baseFieldsPlugin } from "../plugins/base-fields.plugin";

/**
 * 欄位類別(全域資料,租戶不可自訂)。兩個來源:seed 宣告的系統類別(`isSystem: true`)
 * 與 root 在欄位管理畫面新增的類別(`isSystem: false`);seed 宣告同 key 時認養後者(ADR-0002)。
 */
@Schema({ collection: "field_categories", timestamps: true })
export class FieldCategory {
  /** unique,kebab-case(如 gender、demo-category;格式正本 `@repo/domain/form` 的 `FIELD_CATEGORY_KEY_PATTERN`);建立後不可改。 */
  @Prop({ type: String, required: true })
  key!: string;

  /** 類別顯示名稱(如「性別」)。 */
  @Prop({ type: String, required: true })
  name!: string;

  /** 描述說明(選填)。 */
  @Prop({ type: String })
  description?: string;

  /** 來源:`true` = seed 宣告的系統類別(不可停用),`false` = root 在畫面建的。 */
  @Prop({ type: Boolean, default: false })
  isSystem!: boolean;

  /**
   * 停用只影響表單設計器的類別清單與新選;既有欄位用到它照常顯示、執行期選項照常查(ADR-0002:初始 seed 值欄位)。
   */
  @Prop({ type: Boolean, default: true })
  enabled!: boolean;
}

// 由 class 產生 Mongoose Schema(供 MongooseModule 註冊為 model,並掛下方索引)
export const FieldCategorySchema = SchemaFactory.createForClass(FieldCategory);

FieldCategorySchema.index({ key: 1 }, { unique: true });
// 基礎欄位(ADR-0007);全域種子,不掛 tenantScope
FieldCategorySchema.plugin(baseFieldsPlugin);
