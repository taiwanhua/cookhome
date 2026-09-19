import { Field, ID, InputType } from "@nestjs/graphql";

/**
 * 模組的停用 / 啟用(`docs/modules/module-manager.md` 權限表):
 * **停用連動整棵子樹**(子孫一併寫成 `enabled=false`);**啟用只啟用自己這一節**,
 * 下層各自處理 — 與組織管理的停用 / 啟用同一條規則(`SetOrgEnabledInput`)。
 */
@InputType()
export class SetModuleEnabledInput {
  @Field(() => ID)
  id!: string;

  @Field(() => Boolean)
  enabled!: boolean;
}
