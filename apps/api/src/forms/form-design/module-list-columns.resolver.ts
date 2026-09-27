import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";

import { CurrentOperator } from "../../auth/decorators";
import type { OperatorContext } from "../../database/operator-context";
import { RequirePermission } from "../../permission/require-permission.decorator";
import { FormAccessService } from "../form-access.service";
import { FORMS_PERMISSIONS } from "../form-permission-keys";
import {
  ModuleListColumnsPayload,
  SetModuleListColumnsInput,
} from "./module-list-columns";
import { ModuleListColumnsService } from "./module-list-columns.service";

/**
 * 表單模組的列表欄位配置(`modules.settings.list`):讀給該模組的使用者(service 判模組權限),
 * 寫只給站在根組織、持 `system.forms.edit` 的人。
 */
@Resolver(() => ModuleListColumnsPayload)
export class ModuleListColumnsResolver {
  constructor(
    private readonly service: ModuleListColumnsService,
    private readonly access: FormAccessService,
  ) {}

  @Query(() => ModuleListColumnsPayload, { name: "moduleListColumns" })
  async moduleListColumns(
    @Args("moduleKey", { type: () => String }) moduleKey: string,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<ModuleListColumnsPayload> {
    return this.service.get(await this.access.factsOf(operator), moduleKey);
  }

  @RequirePermission(FORMS_PERMISSIONS.edit)
  @Mutation(() => ModuleListColumnsPayload)
  async setModuleListColumns(
    @Args("input") input: SetModuleListColumnsInput,
    @CurrentOperator() operator: OperatorContext,
  ): Promise<ModuleListColumnsPayload> {
    return this.service.set(await this.access.factsOf(operator), input);
  }
}
