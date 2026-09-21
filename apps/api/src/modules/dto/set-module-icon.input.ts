import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 模組的側欄圖示(`docs/modules/module-manager.md` 權限表 `system.module-manager.set-icon`):
 * 根組織專屬,`icon` 必須是白名單 `@repo/domain/module-icon` 的 key,否則 `VALIDATION_FAILED`
 * (`extensions.fields = ["icon"]`)。
 *
 * **缺席與 `null` 同義**(GQL-06 要求寫明):兩者都是「清掉,側欄改用預設圖示」。
 * 這個 input 只有一個可寫欄位,沒有「部分更新」的語意可言,所以不必為了區分而硬造第三種狀態。
 */
@InputType()
export class SetModuleIconInput {
  @Field(() => ID)
  id!: string;

  /** 白名單內的圖示 key;`null`(或不送)= 清回預設圖示。 */
  @Field(() => String, { nullable: true })
  icon?: string | null;
}
