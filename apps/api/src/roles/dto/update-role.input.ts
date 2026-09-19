import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 編輯角色(role-manager.md 權限表「編輯」):只有名稱與描述。
 * GQL-06 的缺席 / null 語意:`name` 缺席 = 不動;`description` 缺席 = 不動、`null` = 清空。
 * 擁有組織建立後不可改(改管轄邊界等於換一個角色,ADR-0003:要不同範圍就建不同角色)。
 */
@InputType()
export class UpdateRoleInput {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  name?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;
}
