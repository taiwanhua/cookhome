import {
  Field,
  GraphQLISODateTime,
  ID,
  ObjectType,
  registerEnumType,
} from "@nestjs/graphql";

import { GraphQLJSONObject } from "../json-object.scalar";

/**
 * 「資料範圍」頁的回傳型別(ADR-0008;根組織專屬模組 `system.data-scope`)。
 *
 * enum 的 GraphQL 值用 SCREAMING_SNAKE_CASE(GQL-01),**內部值維持存進資料庫的小寫字串** —
 * 條件樹本身是 JSON,裡面的 `audience.type` 與這裡是同一套詞彙,不該因為經過 GraphQL 就換一套。
 */

export enum DataScopeFieldTypeEnum {
  ORG = "org",
  USER = "user",
  DATE = "date",
  ENUM = "enum",
}

registerEnumType(DataScopeFieldTypeEnum, {
  name: "DataScopeFieldType",
  description:
    "可篩欄位的型別;決定 UI 出哪些運算子與值來源(ADR-0008 的表,翻譯器不認識個別欄位)",
});

export enum DataScopeAudienceTypeEnum {
  ALL = "all",
  ROLE = "role",
  ORG = "org",
  USER = "user",
}

registerEnumType(DataScopeAudienceTypeEnum, {
  name: "DataScopeAudienceType",
  description: "套用對象:全部人 / 指定角色 / 指定組織 / 指定使用者",
});

export enum DataScopeCombineOpEnum {
  AND = "AND",
  OR = "OR",
}

registerEnumType(DataScopeCombineOpEnum, {
  name: "DataScopeCombineOp",
  description:
    "多條規則命中同一操作者時的頂層合成:OR = 聯集(命中越多看得越多)、AND = 交集",
});

@ObjectType("DataScopeFieldOption")
export class DataScopeFieldOptionModel {
  @Field()
  value!: string;

  @Field()
  label!: string;
}

@ObjectType("DataScopeTargetField")
export class DataScopeTargetFieldModel {
  @Field()
  name!: string;

  @Field()
  label!: string;

  @Field(() => DataScopeFieldTypeEnum)
  type!: DataScopeFieldTypeEnum;

  /** 只有 `ENUM` 型別非空(seed 宣告的固定選項)。 */
  @Field(() => [DataScopeFieldOptionModel])
  options!: DataScopeFieldOptionModel[];

  /** 底座自動掛入的基礎欄位(組織 / 建立者 / 更新者 / 三個時間,ADR-0007),非模組 seed 宣告。 */
  @Field()
  isBase!: boolean;
}

@ObjectType("DataScopeTarget")
export class DataScopeTargetModel {
  /** 資料目標的 collection 名(`demo_items_one`);規則與目標都以它為識別鍵。 */
  @Field()
  collection!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  /** 欄位目錄 = seed 宣告的業務欄位 + 自動掛入的基礎欄位。 */
  @Field(() => [DataScopeTargetFieldModel])
  fields!: DataScopeTargetFieldModel[];

  /**
   * 這個目標**已設規則**(#246 的 1):有規則文件且 `rules` 非空。
   *
   * 與 `dataScopeRule` 的關係:整份覆蓋時送 `rules: []` 等於「刪掉這個目標的規則」
   * (ADR-0008),那之後留下的空文件不算已設規則 —— 判準與執行面一致
   * (`DataScopeService.load`:`rules` 為空即視為沒有規則,查詢只剩租戶保底)。
   * 左清單靠它標「已設規則」,不必對每個目標各查一次 `dataScopeRule`。
   */
  @Field(() => Boolean)
  hasRule!: boolean;
}

@ObjectType("DataScopeAudience")
export class DataScopeAudienceModel {
  @Field(() => DataScopeAudienceTypeEnum)
  type!: DataScopeAudienceTypeEnum;

  /** `ALL` 時為空陣列;其餘為該種類的 id 清單。 */
  @Field(() => [ID])
  ids!: string[];
}

@ObjectType("DataScopeRuleEntry")
export class DataScopeRuleEntryModel {
  @Field(() => DataScopeAudienceModel)
  audience!: DataScopeAudienceModel;

  /** 巢狀 AND / OR 條件樹;形狀見 `apps/api/src/data-scope/data-scope-rule.ts`。 */
  @Field(() => GraphQLJSONObject)
  filter!: Record<string, unknown>;
}

@ObjectType("DataScopeRule")
export class DataScopeRuleModel {
  @Field()
  collection!: string;

  @Field(() => DataScopeCombineOpEnum)
  combineOp!: DataScopeCombineOpEnum;

  @Field(() => [DataScopeRuleEntryModel])
  rules!: DataScopeRuleEntryModel[];

  /** 最後一次儲存的時間(頁面顯示「上次更新」)。 */
  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

/**
 * payload type(GQL-02):query 與 mutation 一律回 payload,不裸回實體 —
 * 之後要加欄位(如 `userErrors`)不必改呼叫端的回傳型別。
 */
@ObjectType("DataScopeTargetsPayload")
export class DataScopeTargetsPayload {
  @Field(() => [DataScopeTargetModel])
  targets!: DataScopeTargetModel[];
}

@ObjectType("DataScopeRulePayload")
export class DataScopeRulePayload {
  /** `null` = 這個目標尚無規則(查詢只受租戶保底;ADR-0008)。 */
  @Field(() => DataScopeRuleModel, { nullable: true })
  rule!: DataScopeRuleModel | null;
}

@ObjectType("SaveDataScopeRulePayload")
export class SaveDataScopeRulePayload {
  /** 儲存後的完整規則(整份覆蓋的結果);儲存成功必有值。 */
  @Field(() => DataScopeRuleModel)
  rule!: DataScopeRuleModel;
}
