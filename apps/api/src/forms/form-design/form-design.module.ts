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
import { RetiredPermissionsResolver } from "./retired-permissions.resolver";

/**
 * 表單設計(`docs/modules/forms.md`):表單、版本、四步發布與重試、分派 / 啟用、
 * 欄位級權限的產生與退役清理。
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
  ],
})
export class FormDesignModule {}
