import { Field, InputType, Int } from "@nestjs/graphql";

/** 清單分頁預設值(與治理模組同一組數字;上限是防呆,不做設定)。 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * 示範模組2 的清單查詢條件。
 *
 * 範圍固定 = 操作者的**可見範圍**(業務資料,ADR-0005 的分工表),由 `tenantScopePlugin` 自動套上;
 * 本 input 的欄位都是在那個範圍**之內**再收窄的篩選條件,不是放寬範圍的手段。
 *
 * 示範模組1 另有 `category` —— 對照組沒有分類欄位,所以這裡沒有(`docs/modules/demo.sample-two.md`)。
 */
@InputType()
export class DemoItemsTwoInput {
  /** 第幾頁,1 起算。 */
  @Field(() => Int, { nullable: true, defaultValue: 1 })
  page?: number;

  @Field(() => Int, {
    nullable: true,
    defaultValue: DEFAULT_PAGE_SIZE,
    description: `每頁筆數,上限 ${String(MAX_PAGE_SIZE)}`,
  })
  pageSize?: number;

  /** 關鍵字:比對名稱與備註(不分大小寫的部分比對);缺席 / null = 不篩。 */
  @Field(() => String, { nullable: true })
  keyword?: string;

  /** 啟用狀態篩選;**缺席 / null = 啟用與停用都列**(GQL-06)。 */
  @Field(() => Boolean, { nullable: true })
  enabled?: boolean | null;
}
