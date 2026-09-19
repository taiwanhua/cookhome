import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 停用 / 啟用選項(`system.field-manager.toggle-enabled`;選項不可刪,舊資料要對照)。
 * 自訂選項 = 當前組織自己的那筆;種子選項的 `enabled` 是**全域**開關,
 * 因此只有根組織操作者切得動(見 field-manager.md「api 介面」)。
 */
@InputType()
export class SetFieldEnabledInput {
  @Field(() => ID)
  id!: string;

  @Field(() => Boolean)
  enabled!: boolean;
}
