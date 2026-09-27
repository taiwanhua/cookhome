import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { FormsCoreModule } from "../forms/forms-core.module";
import { TenantDirectoryService } from "./tenant-directory.service";
import { WorkflowAccessService } from "./workflow-access.service";

/**
 * 審核流程的共用零件(設計端、引擎、申請中心都用):流程的可見 / 可改判準、
 * 「本租戶的人 / 角色」的判斷。操作者事實沿用表單引擎的 `FormAccessService`。
 */
@Module({
  imports: [DatabaseModule, FormsCoreModule],
  providers: [WorkflowAccessService, TenantDirectoryService],
  exports: [WorkflowAccessService, TenantDirectoryService],
})
export class WorkflowsCoreModule {}
