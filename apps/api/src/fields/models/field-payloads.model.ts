import { Field, ObjectType } from "@nestjs/graphql";

import { FieldModel } from "./field.model";

/**
 * 三個寫入 mutation 的共用回傳(GQL-02:mutation 一律回 payload type,
 * 留下之後加欄位的空間 — #201 Interface design 寫的是直接回 `Field!`,此處依 GQL-02 收斂)。
 */
@ObjectType()
export class FieldPayload {
  @Field(() => FieldModel)
  field!: FieldModel;
}
