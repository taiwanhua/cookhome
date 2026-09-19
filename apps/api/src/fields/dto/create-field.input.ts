import { Field, ID, InputType, Int } from "@nestjs/graphql";

/**
 * 新增自訂選項(field-manager.md 權限表 `system.field-manager.create`)。
 * `orgId` 不由呼叫端給 — 一律是操作者的**當前組織**(BaseRepository 自動寫入,ADR-0005)。
 * `value` 在同一類別、同一組織內唯一,且與該類別的全域選項不得相同(→ `FIELD_VALUE_DUPLICATE`)。
 */
@InputType()
export class CreateFieldInput {
  @Field(() => ID)
  categoryId!: string;

  @Field(() => String)
  label!: string;

  /** 儲存值(如 `dessert`);建立後不可改。 */
  @Field(() => String)
  value!: string;

  /** 下拉排序;缺席 = 0(排在種子選項之前,由使用者自行調整)。 */
  @Field(() => Int, { nullable: true })
  order?: number | null;

  @Field(() => String, { nullable: true })
  description?: string | null;
}
