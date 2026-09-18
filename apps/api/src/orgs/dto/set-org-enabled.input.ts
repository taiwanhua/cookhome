import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 停用 / 啟用:停用連動整棵子樹;啟用只啟用自己這一節,下層各自處理
 * (docs/modules/org-manager.md「停用 / 啟用」)。
 */
@InputType()
export class SetOrgEnabledInput {
  @Field(() => ID)
  id!: string;

  @Field(() => Boolean)
  enabled!: boolean;
}
