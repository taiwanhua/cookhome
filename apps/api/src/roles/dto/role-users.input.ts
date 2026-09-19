import { Field, InputType, Int } from "@nestjs/graphql";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "./roles.input";

/** 分配使用者頁籤的清單分頁(範圍 = 被授予這個角色的所有人,含「組織外」者)。 */
@InputType()
export class RoleUsersInput {
  @Field(() => Int, { nullable: true, defaultValue: 1 })
  page?: number;

  @Field(() => Int, {
    nullable: true,
    defaultValue: DEFAULT_PAGE_SIZE,
    description: `每頁筆數,上限 ${String(MAX_PAGE_SIZE)}`,
  })
  pageSize?: number;
}
