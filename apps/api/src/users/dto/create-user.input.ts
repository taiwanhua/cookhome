import { Field, ID, InputType } from "@nestjs/graphql";

import { UserActivationMode } from "../models/user-payloads.model";

/** 啟用方式二選一(ADR-0009);`PASSWORD` 才需要 `initialPassword`。 */
@InputType()
export class UserActivationInput {
  @Field(() => UserActivationMode, { defaultValue: UserActivationMode.EMAIL })
  mode!: UserActivationMode;

  /** 初始密碼(規則同 `@repo/domain/password`);`mode = PASSWORD` 時必填。 */
  @Field(() => String, { nullable: true })
  initialPassword?: string;
}

/** 新增使用者(user-manager.md「新增使用者」;帳號與 Email 各自在 `users` 內唯一,ADR-0003)。 */
@InputType()
export class CreateUserInput {
  @Field(() => String)
  name!: string;

  @Field(() => String)
  account!: string;

  @Field(() => String)
  email!: string;

  @Field(() => String, { nullable: true })
  nickname?: string | null;

  @Field(() => String, { nullable: true })
  gender?: string | null;

  @Field(() => String, { nullable: true })
  phone?: string | null;

  @Field(() => String, { nullable: true })
  address?: string | null;

  /** 身分證字號:要帶值須持 `system.user-manager.edit-national-id`(ADR-0007)。 */
  @Field(() => String, { nullable: true })
  nationalId?: string | null;

  /** 所屬組織(至少一個,且都要在操作者可見範圍內)。 */
  @Field(() => [ID])
  orgIds!: string[];

  /** 角色授予(選填);只能給擁有組織在操作者管理範圍內的角色(防越權,ADR-0003)。 */
  @Field(() => [ID], { nullable: true })
  roleIds?: string[];

  @Field(() => UserActivationInput)
  activation!: UserActivationInput;
}
