import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 轉移租戶擁有者(ADR-0009:v1 僅根組織可操作;擁有者保護的對象隨之換人)。
 * 對象限租戶頂層 — 其他層級沒有擁有者這個概念。
 */
@InputType()
export class TransferOrgOwnerInput {
  /** 租戶頂層組織 id(根組織的直接子組織);其他層級一律 `VALIDATION_FAILED`。 */
  @Field(() => ID)
  orgId!: string;

  /** 新擁有者:啟用中、且所屬組織落在這個租戶(含下層)內的使用者。 */
  @Field(() => ID)
  newOwnerUserId!: string;
}
