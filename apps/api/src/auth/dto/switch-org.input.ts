import { Field, ID, InputType } from "@nestjs/graphql";

/** 切換當前組織:orgId 必須是操作者的所屬組織之一。 */
@InputType()
export class SwitchOrgInput {
  @Field(() => ID)
  orgId!: string;
}
