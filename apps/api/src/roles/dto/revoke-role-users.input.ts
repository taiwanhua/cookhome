import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 移除授予(role-manager.md 權限表「分配使用者」)。
 * 擁有者保護(ADR-0009):租戶擁有者的「租戶管理員」授予不可解除 → `OWNER_PROTECTED`;
 * 根組織的操作者不受此限。沒有這筆授予的人重送不報錯(冪等)。
 */
@InputType()
export class RevokeRoleUsersInput {
  @Field(() => ID)
  roleId!: string;

  @Field(() => [ID])
  userIds!: string[];
}
