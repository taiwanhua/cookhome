import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 編輯組織:只有名稱、描述、商標三個欄位。
 * 擁有者(`ownerUserId`)與可見範圍開關(`settings.visibility`)是租戶作業(#135)的欄位,
 * **刻意不在這個 input 裡** — 拿 `system.org-manager.edit` 也動不到這兩者。
 * 未給的欄位不動;明確給 null 代表清空(描述 / 商標)。
 */
@InputType()
export class UpdateOrgInput {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  name?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  /** `createUploadUrl` 發出的物件路徑;非本 API 簽出來的路徑一律 `VALIDATION_FAILED`(ADR-0010)。 */
  @Field(() => String, { nullable: true })
  logoPath?: string | null;
}
