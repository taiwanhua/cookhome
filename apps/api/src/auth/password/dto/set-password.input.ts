import { Field, InputType } from "@nestjs/graphql";

/** 設定新密碼:token 來自啟用信或重設信的連結(`/set-password?token=…`)。 */
@InputType()
export class SetPasswordInput {
  @Field(() => String)
  token!: string;

  @Field(() => String)
  newPassword!: string;
}
