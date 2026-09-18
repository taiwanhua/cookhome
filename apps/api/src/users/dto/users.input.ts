import { Field, ID, InputType, Int } from "@nestjs/graphql";

/** 清單分頁預設值(治理模組的表格;上限防呆用,不做設定)。 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * 使用者清單的查詢條件:左樹選中的組織 `orgId` 決定範圍 =
 * 「該組織子樹的成員 ∩ 操作者可見組織集」(user-manager.md「清單範圍」、ADR-0005)。
 * 不給 `orgId` 即攤開整個可見範圍(治理模組的慣例,ADR-0005)。
 */
@InputType()
export class UsersInput {
  @Field(() => ID, { nullable: true })
  orgId?: string;

  /** 第幾頁,1 起算。 */
  @Field(() => Int, { nullable: true, defaultValue: 1 })
  page?: number;

  @Field(() => Int, {
    nullable: true,
    defaultValue: DEFAULT_PAGE_SIZE,
    description: `每頁筆數,上限 ${String(MAX_PAGE_SIZE)}`,
  })
  pageSize?: number;

  /** 關鍵字:比對姓名 / 帳號 / Email(不分大小寫的部分比對)。 */
  @Field(() => String, { nullable: true })
  keyword?: string;
}
