import { Field, InputType } from "@nestjs/graphql";

/** 忘記密碼:以 email 定位帳號(ADR-0003:email 只用於信件流程,不作登入識別)。 */
@InputType()
export class RequestPasswordResetInput {
  @Field(() => String)
  email!: string;
}
