import { Field, ID, InputType } from "@nestjs/graphql";

import { UserOrgRemovalPolicy } from "../models/user-payloads.model";

/**
 * 設定所屬組織(全量覆蓋):`orgIds` 是「操作者可見範圍內」的完整結果 —
 * 可見範圍外的既有所屬組織不受影響(彈窗只勾得到可見的,ADR-0003)。
 * 有移除時前端先以 `dryRun = true` 取失去資格清單,再帶著 radio 的選擇送第二次(ADR-0003)。
 */
@InputType()
export class SetUserOrgsInput {
  @Field(() => ID)
  userId!: string;

  @Field(() => [ID])
  orgIds!: string[];

  /** 只算不寫:回 `removedOrgs` + `unqualifiedRoles`,不動資料、不寫稽核。 */
  @Field(() => Boolean, { nullable: true, defaultValue: false })
  dryRun?: boolean;

  /** 失去資格的角色怎麼處理(ADR-0003 radio 三檔);預設 (c)。 */
  @Field(() => UserOrgRemovalPolicy, {
    nullable: true,
    defaultValue: UserOrgRemovalPolicy.REVOKE_ALL_UNQUALIFIED,
  })
  removalPolicy?: UserOrgRemovalPolicy;
}
