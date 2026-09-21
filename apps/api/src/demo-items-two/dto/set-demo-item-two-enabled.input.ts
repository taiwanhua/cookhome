import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 停用 / 啟用示範項目。
 *
 * **守的是 `demo.sample-two.edit`**,不是自己的一顆 `toggle-enabled`:
 * 示範模組2 的權限表只有 view / create / edit / delete 四筆
 * (`apps/db-migrator/seeds/modules/demo.sample-two.ts`,正本 `docs/modules/demo.sample-two.md`),
 * 切啟用狀態屬於「改這一筆」。治理模組(角色 / 欄位管理)另有 `toggle-enabled` 是因為
 * 那裡的停用影響別人的權限,要能單獨授予 —— 業務資料沒有這個需求。
 */
@InputType()
export class SetDemoItemTwoEnabledInput {
  @Field(() => ID)
  id!: string;

  @Field(() => Boolean)
  enabled!: boolean;
}
