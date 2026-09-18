import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 編輯使用者的基本欄位(user-manager.md「編輯使用者」);
 * 所屬組織與角色各有專用 mutation,不在這裡改。未給的欄位不動。
 */
@InputType()
export class UpdateUserInput {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  account?: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  nickname?: string;

  @Field(() => String, { nullable: true })
  gender?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => String, { nullable: true })
  address?: string;

  /** 身分證字號:要改須持 `system.user-manager.edit-national-id`(ADR-0007);空字串 = 清除。 */
  @Field(() => String, { nullable: true })
  nationalId?: string;
}
