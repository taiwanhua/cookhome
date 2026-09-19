import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 指派角色(全量覆蓋):`roleIds` 是「操作者可觸及的角色」這個範圍內的完整結果。
 * 使用者持有但**不在操作者可觸及範圍**的授予不受影響(彈窗根本列不出來,不該被順手解除);
 * 想加的角色不在可觸及範圍 → `ROLE_OUT_OF_REACH`(防越權,ADR-0003)。
 */
@InputType()
export class AssignUserRolesInput {
  @Field(() => ID)
  userId!: string;

  @Field(() => [ID])
  roleIds!: string[];
}
