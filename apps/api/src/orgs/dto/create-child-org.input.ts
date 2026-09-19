import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 新增子組織(輕量入口,不觸發開通流程):掛在目前選中的組織下,
 * 上層限操作者可見範圍內(docs/modules/org-manager.md「新增子組織」)。
 */
@InputType()
export class CreateChildOrgInput {
  @Field(() => ID)
  parentId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string;
}
