import { Field, InputType, Int } from "@nestjs/graphql";

/** 清單分頁預設值(與角色 / 使用者清單同一組;上限防呆用,不做設定)。 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * 示範項目清單的查詢條件。
 *
 * 範圍不在這裡決定:查詢經 `tenantScopePlugin({ kind: "business" })` 自動吃
 * **可見範圍**(ADR-0005)再套**資料範圍規則**(ADR-0008);本 input 的每一欄都是在那個範圍
 * **之內**再收窄的篩選條件,不是放寬範圍的手段。
 */
@InputType()
export class DemoItemsOneInput {
  /** 第幾頁,1 起算。 */
  @Field(() => Int, { nullable: true, defaultValue: 1 })
  page?: number;

  @Field(() => Int, {
    nullable: true,
    defaultValue: DEFAULT_PAGE_SIZE,
    description: `每頁筆數,上限 ${String(MAX_PAGE_SIZE)}`,
  })
  pageSize?: number;

  /**
   * 關鍵字:比對名稱與備註(不分大小寫的部分比對)。
   * **不比對內部備註** —— 否則沒有 `show-internal-note` 的人可以用關鍵字把它試出來。
   */
  @Field(() => String, { nullable: true })
  keyword?: string;

  /** 分類篩選(欄位管理「示範分類」的選項 value);缺席 / null = 不篩。 */
  @Field(() => String, { nullable: true })
  category?: string;

  /** 啟用狀態篩選;缺席 / null = 不篩(啟用與停用都回)。 */
  @Field(() => Boolean, { nullable: true })
  enabled?: boolean;
}
