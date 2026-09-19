import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 刪除角色:前置三項(無授予、非種子角色、非租戶副本)全過才可(軟刪除,ADR-0007);
 * 不過回 `ROLE_NOT_DELETABLE` 附 `extensions.reasons`。
 */
@InputType()
export class DeleteRoleInput {
  @Field(() => ID)
  id!: string;
}
