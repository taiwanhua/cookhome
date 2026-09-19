import { Field, ID, InputType } from "@nestjs/graphql";

import { OrgVisibility } from "../models/org.model";

/**
 * 設定「使用者可見下層組織資料」開關(`orgs.settings.visibility`,ADR-0005;根組織專屬)。
 * 開關只掛在**租戶頂層**、套用整棵子樹 — 下層組織不看自己的,所以對象限租戶頂層。
 */
@InputType()
export class SetOrgVisibilityInput {
  /** 租戶頂層組織 id;其他層級一律 `VALIDATION_FAILED`。 */
  @Field(() => ID)
  orgId!: string;

  /** OWN = 使用者只看自己所屬組織的資料;SUBTREE = 連同其整棵下層。 */
  @Field(() => OrgVisibility)
  visibility!: OrgVisibility;
}
