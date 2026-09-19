import { Field, ID, InputType } from "@nestjs/graphql";

/** 刪除:前置四項全過才可(軟刪除,ADR-0007);不過回 `ORG_NOT_DELETABLE` 附 reasons。 */
@InputType()
export class DeleteOrgInput {
  @Field(() => ID)
  id!: string;
}
