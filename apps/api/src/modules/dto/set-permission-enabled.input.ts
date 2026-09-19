import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 權限的停用 / 啟用 = **全域 kill switch**(`docs/modules/module-manager.md` 權限表):
 * 停用後任何人都不再持有這筆權限,連超級管理員也不給(ADR-0011 步驟 4)。
 * 不連動任何東西 — 權限沒有樹。
 */
@InputType()
export class SetPermissionEnabledInput {
  @Field(() => ID)
  id!: string;

  @Field(() => Boolean)
  enabled!: boolean;
}
