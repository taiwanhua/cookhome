import { Field, ID, InputType } from "@nestjs/graphql";

import { CopyUserOrgRolesMode } from "../models/copy-user-org-roles.model";

/**
 * 把來源使用者的組織與角色複製給目標使用者(一次性,不同步)。
 * 預設 `dryRun = true`:只回差異與 `blockers`,不寫資料、不寫稽核;確認後帶 `dryRun: false` 再送一次,
 * 伺服器端重算、重驗後才寫入。
 */
@InputType()
export class CopyUserOrgRolesInput {
  @Field(() => ID)
  sourceUserId!: string;

  @Field(() => ID)
  targetUserId!: string;

  @Field(() => CopyUserOrgRolesMode)
  mode!: CopyUserOrgRolesMode;

  @Field(() => Boolean, { nullable: true, defaultValue: true })
  dryRun?: boolean;
}
