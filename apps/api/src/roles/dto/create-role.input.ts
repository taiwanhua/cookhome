import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 新增角色(role-manager.md 權限表「新增」)。
 * `ownerOrgId` = **擁有組織 = 這個角色的管轄邊界**(ADR-0003):限操作者的管理範圍內,
 * 不給則預設操作者的當前組織。欄位下固定提示「這個角色的持有者可以管理此組織與它底下的所有組織」。
 * 要不同範圍就建不同角色,不在這裡另立範圍變數。
 */
@InputType()
export class CreateRoleInput {
  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  /** 擁有組織;缺席 = 當前組織(GQL-06:缺席與 null 同義,兩者都取當前組織)。 */
  @Field(() => ID, { nullable: true })
  ownerOrgId?: string | null;
}
