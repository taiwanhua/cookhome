import { Field, ID, ObjectType } from "@nestjs/graphql";

/** 一位使用者的摘要(組織的主管、主管候選人):只給畫得出名字的欄位。 */
@ObjectType()
export class UserSummary {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  account!: string;

  /** 停用的主管留在名單上(可從名單移除),但解析時不算。 */
  @Field(() => Boolean)
  enabled!: boolean;
}
