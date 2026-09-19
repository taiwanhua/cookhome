import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";

import { CurrentOperator } from "../auth/decorators";
import type { OperatorContext } from "../database/operator-context";
import { RequirePermission } from "../permission/require-permission.decorator";
import { SetModuleEnabledInput } from "./dto/set-module-enabled.input";
import { SetPermissionEnabledInput } from "./dto/set-permission-enabled.input";
import {
  ModuleAdminNode,
  ModuleAdminPayload,
  PermissionAdminPayload,
} from "./models/module-admin.model";
import { ModuleManagerService } from "./module-manager.service";

/**
 * 權限 key(`docs/modules/module-manager.md` 權限表;種子 `apps/db-migrator/seeds/modules/system.ts`)。
 * 模組本身 `isRootOnly`,租戶管理員模板不含它,所以租戶永遠拿不到這兩筆(ADR-0009 第 3 步)。
 */
const PERMISSIONS = {
  view: "system.module-manager.view",
  toggleEnabled: "system.module-manager.toggle-enabled",
} as const;

/**
 * 模組與權限的 GraphQL 端點(形式 GQL-02、錯誤 GQL-04)。
 * resolver 薄:守門交給 `@RequirePermission`,「必須站在根組織」與全部規則在
 * `ModuleManagerService`(與租戶作業同一個分工,`tenant-ops.resolver.ts`)。
 */
@Resolver(() => ModuleAdminNode)
export class ModuleManagerResolver {
  constructor(private readonly service: ModuleManagerService) {}

  /** 全樹(含 hidden 與隱藏 `api` 樹、含已停用者);每個模組附這一層的全部權限。 */
  @RequirePermission(PERMISSIONS.view)
  @Query(() => [ModuleAdminNode])
  moduleTree(
    @CurrentOperator() operator: OperatorContext,
  ): Promise<ModuleAdminNode[]> {
    return this.service.tree(operator);
  }

  /** 停用連動整棵子樹;啟用只啟用自己。回傳這一枝的最新狀態。 */
  @RequirePermission(PERMISSIONS.toggleEnabled)
  @Mutation(() => ModuleAdminPayload)
  async setModuleEnabled(
    @Args("input") input: SetModuleEnabledInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<ModuleAdminPayload> {
    return { module: await this.service.setModuleEnabled(operator, input) };
  }

  /** 全域 kill switch:停用後連超級管理員也不再持有這筆權限(ADR-0011 步驟 4)。 */
  @RequirePermission(PERMISSIONS.toggleEnabled)
  @Mutation(() => PermissionAdminPayload)
  async setPermissionEnabled(
    @Args("input") input: SetPermissionEnabledInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<PermissionAdminPayload> {
    return {
      permission: await this.service.setPermissionEnabled(operator, input),
    };
  }
}
