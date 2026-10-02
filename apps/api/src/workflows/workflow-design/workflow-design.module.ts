import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module";
import { FormDesignModule } from "../../forms/form-design/form-design.module";
import { FormsCoreModule } from "../../forms/forms-core.module";
import { WorkflowsCoreModule } from "../workflows-core.module";
import { WorkflowBindingsResolver } from "./workflow-bindings.resolver";
import { WorkflowBindingsService } from "./workflow-bindings.service";
import { WorkflowDefinitionChecker } from "./workflow-definition-checker";
import {
  WorkflowPublishHooks,
  WorkflowPublishService,
} from "./workflow-publish.service";
import { WorkflowVersionsService } from "./workflow-versions.service";
import { WorkflowsResolver } from "./workflows.resolver";
import { WorkflowsService } from "./workflows.service";

/**
 * 流程設計(`docs/modules/workflows.md`):流程、版本、四步發布與重試(與表單共用
 * `versioning/version-lifecycle.ts`)、分派 / 收回 / fork、表單的流程綁定。
 */
@Module({
  imports: [
    DatabaseModule,
    FormsCoreModule,
    FormDesignModule,
    WorkflowsCoreModule,
  ],
  providers: [
    WorkflowDefinitionChecker,
    WorkflowPublishHooks,
    WorkflowPublishService,
    WorkflowVersionsService,
    WorkflowsService,
    WorkflowBindingsService,
    WorkflowsResolver,
    WorkflowBindingsResolver,
  ],
  // 受管定義安裝(`seed/`)沿用的建立、草稿、檢查與發布
  exports: [
    WorkflowsService,
    WorkflowVersionsService,
    WorkflowPublishService,
    WorkflowDefinitionChecker,
  ],
})
export class WorkflowDesignModule {}
