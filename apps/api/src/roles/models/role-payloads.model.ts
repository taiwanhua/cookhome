import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

import { RoleModel } from "./role.model";

/** 清單分頁(GQL-03 的 `items` + `totalCount`;分頁參數依 #130 介面設計用 page / pageSize)。 */
@ObjectType()
export class RolesPayload {
  @Field(() => [RoleModel])
  items!: RoleModel[];

  @Field(() => Int)
  totalCount!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;
}

/** 單一角色的寫入結果(GQL-02:mutation 一律回 payload type)。 */
@ObjectType()
export class RolePayload {
  @Field(() => RoleModel)
  role!: RoleModel;
}

/** 分配使用者頁籤的一列:使用者 + 「組織外」標記。 */
@ObjectType()
export class RoleUserOrg {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;
}

/**
 * 被授予這個角色的一位使用者。
 *
 * api 介面(GQL-07):
 * - `orgs`:該使用者的所屬組織,只列操作者**管理範圍**內的(範圍外的不露名稱也不露 id)
 * - `outOfScope`:所屬組織皆不在角色擁有組織的子樹內(ADR-0003「失去資格」的同一判斷);
 *   授予照常有效,UI 標 Warning Tag「組織外」。白話文案由前端依此旗標顯示,不從 api 傳
 */
@ObjectType()
export class RoleUser {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  account!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  email!: string;

  @Field(() => Boolean)
  enabled!: boolean;

  @Field(() => [RoleUserOrg])
  orgs!: RoleUserOrg[];

  @Field(() => Boolean)
  outOfScope!: boolean;

  /**
   * 擁有者保護(ADR-0009):這位是租戶擁有者、而這個角色是他的「租戶管理員」授予,
   * 解除會被 `OWNER_PROTECTED` 擋下(根組織操作者不受限);UI 據此把「移除」設為 disabled。
   */
  @Field(() => Boolean)
  ownerProtected!: boolean;
}

/** 分配使用者頁籤的清單(分頁形狀同 `RolesPayload`)。 */
@ObjectType()
export class RoleUsersPayload {
  @Field(() => RoleModel)
  role!: RoleModel;

  @Field(() => [RoleUser])
  items!: RoleUser[];

  @Field(() => Int)
  totalCount!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;
}
