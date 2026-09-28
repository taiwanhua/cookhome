import { Args, ID, Int, Mutation, Query, Resolver } from "@nestjs/graphql";

import { CurrentOperator } from "../../auth/decorators";
import type { OperatorContext } from "../../database/operator-context";
import { FormAccessService } from "../form-access.service";
import { UpgradeFormSubmissionsInput } from "./dto/form-runtime.input";
import { FormUpgradeService } from "./form-upgrade.service";
import {
  FormUpgradePayload,
  FormUpgradePlan,
} from "./models/form-upgrade.model";

/**
 * 舊版資料升級到新版(版本面板的「將舊版資料升級到此版」;只限沒綁流程的表單)。
 * 權限是執行期的(表單所屬模組的 `edit`),由 service 判,不寫成 `@RequirePermission`。
 */
@Resolver()
export class FormUpgradeResolver {
  constructor(
    private readonly service: FormUpgradeService,
    private readonly access: FormAccessService,
  ) {}

  /** 各舊版本筆數 + 補值欄位(守門同 `upgradeFormSubmissions`)。 */
  @Query(() => FormUpgradePlan, { name: "formUpgradePlan" })
  async formUpgradePlan(
    @Args("formKey", { type: () => ID }) formKey: string,
    @Args("targetVersion", { type: () => Int }) targetVersion: number,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FormUpgradePlan> {
    return this.service.plan(
      await this.access.factsOf(operator),
      formKey,
      targetVersion,
    );
  }

  /** 改綁 + 補值 + 重算,不驗證;被人同時改的、超過容量的跳過並計數。 */
  @Mutation(() => FormUpgradePayload)
  async upgradeFormSubmissions(
    @Args("input") input: UpgradeFormSubmissionsInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<FormUpgradePayload> {
    return this.service.upgrade(await this.access.factsOf(operator), input);
  }
}
