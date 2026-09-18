import { Field, ObjectType } from "@nestjs/graphql";

/** access token 回 body、前端只放記憶體;refresh token 走 httpOnly cookie,不在 payload(ADR-0003)。 */
@ObjectType()
export class LoginPayload {
  @Field(() => String)
  accessToken!: string;
}

@ObjectType()
export class RefreshPayload {
  @Field(() => String)
  accessToken!: string;
}

@ObjectType()
export class SwitchOrgPayload {
  @Field(() => String)
  accessToken!: string;
}

@ObjectType()
export class LogoutPayload {
  @Field(() => Boolean)
  success!: boolean;
}

@ObjectType()
export class LogoutAllDevicesPayload {
  @Field(() => Boolean)
  success!: boolean;
}
