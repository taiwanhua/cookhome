import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";

import { CurrentOperator } from "../auth/decorators";
import type { OperatorContext } from "../database/operator-context";
import { RequirePermission } from "../permission/require-permission.decorator";
import { ProvisionTenantInput } from "./dto/provision-tenant.input";
import { SetOrgVisibilityInput } from "./dto/set-org-visibility.input";
import { TransferOrgOwnerInput } from "./dto/transfer-org-owner.input";
import { OrgPayload } from "./models/org-payloads.model";
import {
  ModuleOption,
  ProvisionTenantPayload,
} from "./models/tenant-ops.model";
import { TenantOpsService } from "./tenant-ops.service";

/**
 * 權限 key(docs/modules/org-manager.md 權限表的後三列;種子 apps/db-migrator/seeds/modules/system.ts)。
 * 三筆都屬 `system.org-manager.tenant-ops` — 一個 `isRootOnly` 的隱藏模組,
 * 租戶管理員模板複製時整個模組被扣除,所以租戶永遠拿不到(ADR-0009 第 3 步)。
 */
const PERMISSIONS = {
  provision: "system.org-manager.tenant-ops.provision",
  transferOwner: "system.org-manager.tenant-ops.transfer-owner",
  setVisibility: "system.org-manager.tenant-ops.set-visibility",
} as const;

/**
 * 租戶作業的 GraphQL 端點(彈窗開在組織管理頁上,但權限屬 tenant-ops)。
 * resolver 薄:守門交給 `@RequirePermission`,「必須站在根組織」與全部規則在 TenantOpsService。
 */
@Resolver()
export class TenantOpsResolver {
  constructor(private readonly tenantOps: TenantOpsService) {}

  /** 開通彈窗的模組勾選清單(= 租戶管理員模板綁的模組;前端預設全勾)。 */
  @RequirePermission(PERMISSIONS.provision)
  @Query(() => [ModuleOption])
  tenantModuleOptions(
    @CurrentOperator() operator: OperatorContext,
  ): Promise<ModuleOption[]> {
    return this.tenantOps.moduleOptions(operator);
  }

  /** 開通租戶:ADR-0009 四步 + 擁有者 + 啟用信,整段失敗以補償刪除回滾。 */
  @RequirePermission(PERMISSIONS.provision)
  @Mutation(() => ProvisionTenantPayload)
  provisionTenant(
    @Args("input") input: ProvisionTenantInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<ProvisionTenantPayload> {
    return this.tenantOps.provision(operator, input);
  }

  @RequirePermission(PERMISSIONS.transferOwner)
  @Mutation(() => OrgPayload)
  async transferOrgOwner(
    @Args("input") input: TransferOrgOwnerInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<OrgPayload> {
    return { org: await this.tenantOps.transferOwner(operator, input) };
  }

  @RequirePermission(PERMISSIONS.setVisibility)
  @Mutation(() => OrgPayload)
  async setOrgVisibility(
    @Args("input") input: SetOrgVisibilityInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<OrgPayload> {
    return { org: await this.tenantOps.setVisibility(operator, input) };
  }
}
