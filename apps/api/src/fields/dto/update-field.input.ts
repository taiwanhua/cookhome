import { Field, ID, InputType, Int } from "@nestjs/graphql";

/**
 * 編輯自訂選項(`system.field-manager.edit`)。
 * `value` 不在此 — 建立後不可改(舊資料以它對照);種子選項一律 `FORBIDDEN`,只能 `setFieldEnabled`。
 * 缺席 / null 語意(GQL-06):`label` / `order` 缺席 = 不動;
 * `description` 缺席 = 不動、`null` = 清空。
 */
@InputType()
export class UpdateFieldInput {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  label?: string;

  @Field(() => Int, { nullable: true })
  order?: number | null;

  @Field(() => String, { nullable: true })
  description?: string | null;
}
