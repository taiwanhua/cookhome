import { Field, InputType } from "@nestjs/graphql";

/** 登入識別 = account(ADR-0003;email 只用於信件流程)。 */
@InputType()
export class LoginInput {
  @Field(() => String)
  account!: string;

  @Field(() => String)
  password!: string;
}
