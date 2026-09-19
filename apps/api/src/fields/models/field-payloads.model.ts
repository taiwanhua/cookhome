import { Field, Int, ObjectType } from "@nestjs/graphql";

import { FieldCategoryModel, FieldModel } from "./field.model";

/**
 * 三個寫入 mutation 的共用回傳(GQL-02:mutation 一律回 payload type,
 * 留下之後加欄位的空間 — #201 Interface design 寫的是直接回 `Field!`,
 * 主流程 2026-09-20 裁決:那是簡寫,四票一律照 GQL-02 用 payload type)。
 */
@ObjectType()
export class FieldPayload {
  @Field(() => FieldModel)
  field!: FieldModel;
}

/** 類別清單(GQL-03 的列表形狀;全域種子不分頁,`totalCount` 即 `items` 長度)。 */
@ObjectType()
export class FieldCategoriesPayload {
  @Field(() => [FieldCategoryModel])
  items!: FieldCategoryModel[];

  @Field(() => Int)
  totalCount!: number;
}

/** 一個類別下的合併清單(GQL-03 的列表形狀;不分頁,`totalCount` 即 `items` 長度)。 */
@ObjectType()
export class FieldsPayload {
  @Field(() => [FieldModel])
  items!: FieldModel[];

  @Field(() => Int)
  totalCount!: number;
}
