import { Field, ID, InputType } from "@nestjs/graphql";

/** 搬移:改上層組織;限同租戶(`CROSS_TENANT`)、不可搬進自己的子樹(`CYCLIC_MOVE`)。 */
@InputType()
export class MoveOrgInput {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  newParentId!: string;
}
