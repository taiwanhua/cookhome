import { Field, Int, ObjectType } from "@nestjs/graphql";

import { GraphQLJSONObject } from "../../../data-scope/json-object.scalar";

/** 升級跳過一筆的原因。 */
export const FORM_UPGRADE_SKIP_REASONS = [
  /** 讀到之後被別人改了(`expectedEditVersion` 條件更新沒命中)。 */
  "EDIT_CONFLICT",
  /** 加上升級修訂後整份文件會超過容量上限。 */
  "DOCUMENT_TOO_LARGE",
  /** 存值在目標版算不出來(型別不合法的舊資料)。 */
  "VALUES_INVALID",
] as const;

export type FormUpgradeSkipReason = (typeof FORM_UPGRADE_SKIP_REASONS)[number];

/** 某個舊版本的筆數(升級計畫:待升級;升級結果:已升級)。 */
@ObjectType()
export class FormUpgradeGroup {
  @Field(() => Int)
  fromVersion!: number;

  @Field(() => Int)
  count!: number;
}

/** 跳過的筆數與原因。 */
@ObjectType()
export class FormUpgradeSkip {
  /** `EDIT_CONFLICT` / `DOCUMENT_TOO_LARGE` / `VALUES_INVALID`。 */
  @Field(() => String)
  reason!: FormUpgradeSkipReason;

  @Field(() => Int)
  count!: number;
}

/** 舊版資料升級的計畫(`formUpgradePlan`)。 */
@ObjectType()
export class FormUpgradePlan {
  /** 操作者看得到、草稿 / 已完成、版本不是目標版的筆數,依舊版本分組(版本小的在前)。 */
  @Field(() => [FormUpgradeGroup])
  groups!: FormUpgradeGroup[];

  /**
   * 補值欄位(目標版的 FieldDef,依目標版順序):必填的使用者填欄位 ∪ 對到摘要槽的欄位 ∪ 目標版新增的欄位;
   * 明細列 / 上傳 / 引用不列入;只列操作者改得動的欄位。
   */
  @Field(() => [GraphQLJSONObject])
  fillTargets!: Record<string, unknown>[];
}

/** 舊版資料升級的結果(`upgradeFormSubmissions`)。 */
@ObjectType()
export class FormUpgradePayload {
  @Field(() => [FormUpgradeGroup])
  upgraded!: FormUpgradeGroup[];

  @Field(() => [FormUpgradeSkip])
  skipped!: FormUpgradeSkip[];
}
