import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 加入使用者(role-manager.md 權限表「分配使用者」):**增量加入**,不是全量覆蓋 —
 * 彈窗送的是這次選的人,既有授予不受影響(移除走 `revokeRoleUsers`)。
 * 候選規則(ADR-0003「被授予角色的資格」):使用者的所屬組織至少一個落在角色擁有組織的子樹內,
 * 否則 `USER_NOT_ELIGIBLE`;只在按下授予的當下檢查一次,之後不再檢查。
 * 已經持有的人重送不報錯(冪等),計為未變。
 */
@InputType()
export class GrantRoleUsersInput {
  @Field(() => ID)
  roleId!: string;

  @Field(() => [ID])
  userIds!: string[];
}
