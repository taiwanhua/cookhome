import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 設定租戶時區(`orgs.settings.timezone`)。時區只掛在**租戶頂層**、整個租戶共用,
 * 所以對象限租戶頂層;讀取端是 `tenantTimezoneOf`(沒設或不合法 → 預設時區)。
 */
@InputType()
export class SetOrgTimezoneInput {
  /** 租戶頂層組織 id;其他層級一律 `VALIDATION_FAILED`。 */
  @Field(() => ID)
  orgId!: string;

  /** IANA 時區名(如 `Asia/Taipei`);null = 清除設定、退回預設時區。 */
  @Field(() => String, { nullable: true })
  timezone!: string | null;
}
