import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 類別清單的篩選(`fieldCategories(input)`;GQL-03 的「篩選包進單一 input」)。
 * `enabledOnly` 缺席 / null / false = 全部(欄位管理頁要看得到停用的);`true` = 只列啟用的
 * (表單設計器的類別下拉)。
 */
@InputType()
export class FieldCategoriesInput {
  @Field(() => Boolean, { nullable: true })
  enabledOnly?: boolean | null;
}

/**
 * root 在畫面新增類別(`manage-categories`,限站在根組織)。
 * `key` 格式同種子 key(`@repo/domain/form` 的 `FIELD_CATEGORY_KEY_PATTERN`)、唯一、建立後不可改。
 * `description` 缺席 / null = 不寫。
 */
@InputType()
export class CreateFieldCategoryInput {
  @Field(() => String)
  key!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;
}

/**
 * 改類別名稱 / 說明(只限 root 在畫面建的類別;系統類別 → `FORBIDDEN` + `SYSTEM_CATEGORY`)。`key` 不在此 —— 建立後不可改。
 * 缺席 / null 語意(GQL-06):`name` 缺席 = 不動;`description` 缺席 = 不動、`null` = 清空。
 */
@InputType()
export class UpdateFieldCategoryInput {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  name?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;
}

/** 停用 / 啟用類別;系統類別不可停用(啟用可以)。類別不可刪。 */
@InputType()
export class SetFieldCategoryEnabledInput {
  @Field(() => ID)
  id!: string;

  @Field(() => Boolean)
  enabled!: boolean;
}
