import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 設定時區(`orgs.settings.timezone`)。時區只掛在**根組織**與**租戶頂層**(整個租戶共用),
 * 所以對象限這兩種;讀取端是 `tenantTimezoneOf`(沒設或不合法 → 預設時區)。
 */
@InputType()
export class SetOrgTimezoneInput {
  /** 根組織或租戶頂層的 id;其他層級一律 `VALIDATION_FAILED`。 */
  @Field(() => ID)
  orgId!: string;

  /** IANA 時區名(如 `Asia/Taipei`);null = 清除設定、退回預設時區。 */
  @Field(() => String, { nullable: true })
  timezone!: string | null;
}
