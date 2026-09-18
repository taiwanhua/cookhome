import { Field, ObjectType } from "@nestjs/graphql";

/** 存在 / 不存在的 email 都回 success=true(不透露帳號是否存在)。 */
@ObjectType()
export class RequestPasswordResetPayload {
  @Field(() => Boolean)
  success!: boolean;
}

/** 設定新密碼成功即登入:access token 回 body,refresh token 走 httpOnly cookie(同 login)。 */
@ObjectType()
export class SetPasswordPayload {
  @Field(() => String)
  accessToken!: string;
}

@ObjectType()
export class ChangePasswordPayload {
  @Field(() => Boolean)
  success!: boolean;
}
