import { Field, InputType } from "@nestjs/graphql";

/** 已登入者改密碼(首登強改亦用此)。 */
@InputType()
export class ChangePasswordInput {
  @Field(() => String)
  currentPassword!: string;

  @Field(() => String)
  newPassword!: string;
}
