import { Field, ID, Int, ObjectType, registerEnumType } from "@nestjs/graphql";

/**
 * 一筆選項的來源(field-manager.md「UI 規格」的「來源」欄)。
 * 合併清單只含這兩種:全域種子(`orgId = null`)與**當前組織**自訂(`orgId = currentOrgId`);
 * 下層組織 / 其他組織的自訂選項不會出現在清單裡(ADR-0005)。
 */
export enum FieldSource {
  /** 全域種子(orgId = null,ADR-0002);只能切換 enabled。 */
  GLOBAL = "GLOBAL",
  /** 當前組織自訂(orgId = 當前組織);label / order / description 可編輯。 */
  OWN = "OWN",
}

registerEnumType(FieldSource, {
  name: "FieldSource",
  description: "欄位選項的來源:全域種子 / 當前組織自訂(field-manager.md)",
});

/** 欄位類別(全域種子,租戶不可自訂;新增類別走 code + PR)。 */
@ObjectType("FieldCategory")
export class FieldCategoryModel {
  @Field(() => ID)
  id!: string;

  /** kebab-case 的種子 key(如 `gender`);前端做穩定識別用。 */
  @Field(() => String)
  key!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;
}

/**
 * 欄位選項(`system.field-manager` 的主要型別)。
 * `value` 建立後不可改(舊資料以它對照),所以 `updateField` 的 input 沒有這個欄位。
 */
@ObjectType("Field")
export class FieldModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  categoryId!: string;

  @Field(() => String)
  label!: string;

  @Field(() => String)
  value!: string;

  @Field(() => Int)
  order!: number;

  /** 停用即新填寫不再出現;既有資料不受影響(選項不可刪)。 */
  @Field(() => Boolean)
  enabled!: boolean;

  @Field(() => String, { nullable: true })
  description!: string | null;

  /** 來源:`GLOBAL` = 全域種子、`OWN` = 當前組織自訂。 */
  @Field(() => FieldSource)
  source!: FieldSource;
}
