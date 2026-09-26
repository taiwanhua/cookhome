import { Parent, ResolveField, Resolver } from "@nestjs/graphql";
import { Types } from "mongoose";

import { CurrentOperator } from "../auth/decorators";
import { MeOrg } from "../auth/models/me.model";
import type { OperatorContext } from "../database/operator-context";
import { FormAccessService } from "./form-access.service";

/**
 * `me.currentOrg.timezone`(#482):讀者當前組織的**租戶時區**(租戶頂層的 `orgs.settings.timezone`,
 * 沒設 = `Asia/Taipei`;根組織讀根組織的設定)。表單引擎的日期時間欄以它輸入與顯示,
 * 草稿與沒有 `ctx` 的地方也用它;已送出的修訂一律用那次修訂自己的 `ctx.timezone`。
 * 以 field resolver 掛在 `MeOrg` 上(先例:`storage/me-org-logo.resolver.ts`),只有客戶端問才查。
 */
@Resolver(() => MeOrg)
export class MeOrgTimezoneResolver {
  constructor(private readonly access: FormAccessService) {}

  @ResolveField(() => String)
  timezone(
    @Parent() org: MeOrg,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<string> {
    return this.access.timezoneOfOrg(operator, new Types.ObjectId(org.id));
  }
}
