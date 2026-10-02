import { Module } from "@nestjs/common";

import { OperatorContextService } from "../auth/operator-context.service";
import { DatabaseModule } from "../database/database.module";
import { FormDesignModule } from "../forms/form-design/form-design.module";
import { FormsCoreModule } from "../forms/forms-core.module";
import { OwnerProtectionService } from "../orgs/owner-protection.service";
import { WorkflowDesignModule } from "../workflows/workflow-design/workflow-design.module";
import { DefinitionInstaller } from "./definition-installer";
import { DefinitionSeedService } from "./definition-seed.service";
import { FormDefinitionAdapter } from "./form-definition.adapter";
import { SeedInstallHooks } from "./seed-install-hooks";
import { SeedLockVerifier } from "./seed-lock.verifier";
import { SeedOperatorService } from "./seed-operator.service";
import { WorkflowDefinitionAdapter } from "./workflow-definition.adapter";

/**
 * 受管定義的安裝(`docs/concepts/data-layer-and-isolation.md`「受管表單與流程」):程序介面、安裝流程、
 * 表單 / 流程適配、操作者解析與鎖核對。寫入全部經 `FormDesignModule` / `WorkflowDesignModule` 匯出的原服務。
 *
 * `OperatorContextService`、`OwnerProtectionService` 以**既有的 class** 直接註冊(兩者都沒有狀態):
 * 匯入它們原本所在的 `AuthModule` / `OrgsModule` 會連登入守門、寄信與檔案儲存一起啟動,CLI 不需要。
 * 權限解析與稽核由 @Global 的 PermissionModule / AuditModule 提供,由組裝端匯入。
 *
 * 不掛在 `AppModule`:沒有 resolver、不對外開端點,只給 `SeedRuntimeModule`(CLI)組裝。
 */
@Module({
  imports: [
    DatabaseModule,
    FormsCoreModule,
    FormDesignModule,
    WorkflowDesignModule,
  ],
  providers: [
    OperatorContextService,
    OwnerProtectionService,
    SeedInstallHooks,
    SeedLockVerifier,
    SeedOperatorService,
    FormDefinitionAdapter,
    WorkflowDefinitionAdapter,
    DefinitionInstaller,
    DefinitionSeedService,
  ],
  exports: [DefinitionSeedService, OwnerProtectionService],
})
export class DefinitionSeedModule {}
