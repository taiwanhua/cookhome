import { Field, ID, InputType } from "@nestjs/graphql";

import { GraphQLJSONObject } from "../json-object.scalar";
import {
  DataScopeAudienceTypeEnum,
  DataScopeCombineOpEnum,
} from "../models/data-scope.model";

/**
 * 儲存某資料目標的規則(ADR-0008;**整份覆蓋** — 送出的就是之後生效的全部)。
 * `rules` 為空陣列 = 這個目標沒有任何規則,查詢只剩租戶保底(等於「刪規則」)。
 */
@InputType()
export class DataScopeAudienceInput {
  @Field(() => DataScopeAudienceTypeEnum)
  type!: DataScopeAudienceTypeEnum;

  /** `ALL` 以外必給且非空;不合法 → `RULE_INVALID`(`path` = `rules[n].audience.ids`)。 */
  @Field(() => [ID], { nullable: true })
  ids?: string[];
}

@InputType()
export class DataScopeRuleEntryInput {
  @Field(() => DataScopeAudienceInput)
  audience!: DataScopeAudienceInput;

  /**
   * 巢狀條件樹(JSON;形狀與存進 `data_scope_rules` 的完全一致,見 `data-scope-rule.ts`)。
   * 欄位 / 運算子 / 值來源三者的相符檢查在 service,錯誤以 `RULE_INVALID` 附 `path` 回報。
   */
  @Field(() => GraphQLJSONObject)
  filter!: Record<string, unknown>;
}

@InputType()
export class SaveDataScopeRuleInput {
  /** 資料目標;不在 `data_scope_targets` → `NOT_FOUND`。 */
  @Field()
  collection!: string;

  @Field(() => DataScopeCombineOpEnum, {
    defaultValue: DataScopeCombineOpEnum.OR,
  })
  combineOp!: DataScopeCombineOpEnum;

  @Field(() => [DataScopeRuleEntryInput])
  rules!: DataScopeRuleEntryInput[];
}
