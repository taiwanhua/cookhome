import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

/**
 * 角色的擁有組織(`org_role`;每個角色只屬一個組織,ADR-0003)。
 * 它同時是這個角色的**管轄邊界** — 持有者在治理模組能操作的組織 = 這個組織的整棵子樹
 * (CONTEXT.md「管理範圍」);角色管理頁的欄位提示用同一句白話。
 */
@ObjectType()
export class RoleOwnerOrg {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;
}

/**
 * 角色(`system.role-manager` 的主要型別)。
 *
 * api 介面(GQL-07:欄位語意的正本在此,前端段只引用):
 * - `ownerOrg`:擁有組織;清單只回擁有組織在操作者**管理範圍**內的角色,所以正常情況恆有值,
 *   資料損毀(沒有 `org_role`)時為 null
 * - `isSystem`:種子角色(`super-admin` / `tenant-admin` 模板),不可刪除
 * - `isTemplateCopy`:開通租戶時從「租戶管理員」模板複製出來的副本(`settings.templateKey`,ADR-0009);
 *   不可刪除,且權限矩陣**只能縮不能擴**
 * - `userCount`:被授予這個角色的人數(`user_role`),含「組織外」的授予(ADR-0003:授予照常有效)
 */
@ObjectType("Role")
export class RoleModel {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  /** 停用後持有者的該角色立即不生效(授予仍在,PermissionResolver 排除,ADR-0011)。 */
  @Field(() => Boolean)
  enabled!: boolean;

  @Field(() => Boolean)
  isSystem!: boolean;

  @Field(() => Boolean)
  isTemplateCopy!: boolean;

  @Field(() => RoleOwnerOrg, { nullable: true })
  ownerOrg!: RoleOwnerOrg | null;

  @Field(() => Int)
  userCount!: number;
}
