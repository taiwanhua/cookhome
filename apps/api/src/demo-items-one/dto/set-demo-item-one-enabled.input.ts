import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 停用 / 啟用示範項目(需 `demo.sub.sample-one.edit`)。
 * **不套自鎖保護**(`SELF_LOCK`):停用一筆業務資料隨時可以再啟用回來,
 * 不會讓操作者失去繼續操作的能力(自鎖只守「關掉就再也開不回來」的寫入)。
 */
@InputType()
export class SetDemoItemOneEnabledInput {
  @Field(() => ID)
  id!: string;

  @Field(() => Boolean)
  enabled!: boolean;
}
