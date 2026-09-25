import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module";
import { FormsCoreModule } from "../forms-core.module";
import { FormDefinitionChecker } from "./form-definition-checker";
import { FormFieldPermissionsService } from "./form-field-permissions.service";
import { FormPublishHooks } from "./form-publish-hooks";
import { FormPublishService } from "./form-publish.service";
import { FormVersionsResolver } from "./form-versions.resolver";
import { FormVersionsService } from "./form-versions.service";
import { FormsResolver } from "./forms.resolver";
import { FormsService } from "./forms.service";
import { ModuleListColumnsResolver } from "./module-list-columns.resolver";
import { ModuleListColumnsService } from "./module-list-columns.service";
import { RetiredPermissionsResolver } from "./retired-permissions.resolver";

/**
 * 表單設計(`docs/modules/forms.md`):表單、版本、四步發布與重試、分派 / 啟用、
 * 欄位級權限的產生與退役清理、表單模組的列表欄位配置。
 */
@Module({
  imports: [DatabaseModule, FormsCoreModule],
  providers: [
    FormDefinitionChecker,
    FormFieldPermissionsService,
    FormPublishHooks,
    FormPublishService,
    FormVersionsService,
    FormsService,
    FormsResolver,
    FormVersionsResolver,
    RetiredPermissionsResolver,
    ModuleListColumnsService,
    ModuleListColumnsResolver,
  ],
})
export class FormDesignModule {}
