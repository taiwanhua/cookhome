import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module";
import { StorageModule } from "../../storage/storage.module";
import { FormsCoreModule } from "../forms-core.module";
import { DisplayNamesService } from "./display-names.service";
import { FormLookupService } from "./form-lookup.service";
import { FormSubmissionsResolver } from "./form-submissions.resolver";
import { FormSubmissionsService } from "./form-submissions.service";

/**
 * 表單執行(`docs/modules/forms.md`):新增選單、草稿 / 送出 / 修訂快照、欄位級投影、
 * 顯示名解析、lookup、附件下載網址。檔案儲存走 StorageModule(附件私有,ADR-0010)。
 */
@Module({
  imports: [DatabaseModule, StorageModule, FormsCoreModule],
  providers: [
    DisplayNamesService,
    FormLookupService,
    FormSubmissionsService,
    FormSubmissionsResolver,
  ],
})
export class FormRuntimeModule {}
