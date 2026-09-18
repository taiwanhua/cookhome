import { Field, ID, InputType } from "@nestjs/graphql";

/** 停用 / 啟用使用者;停用即刻作廢該使用者全部 refresh token(user-manager.md)。 */
@InputType()
export class SetUserEnabledInput {
  @Field(() => ID)
  id!: string;

  @Field(() => Boolean)
  enabled!: boolean;
}
