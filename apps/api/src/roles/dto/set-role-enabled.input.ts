import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 停用 / 啟用角色(role-manager.md 權限表「停用 / 啟用」):
 * 停用後持有者的該角色立即不生效(授予仍在;PermissionResolver 排除 enabled=false,ADR-0011)。
 */
@InputType()
export class SetRoleEnabledInput {
  @Field(() => ID)
  id!: string;

  @Field(() => Boolean)
  enabled!: boolean;
}
