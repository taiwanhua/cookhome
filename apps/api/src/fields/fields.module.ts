import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { FieldsResolver } from "./fields.resolver";
import { FieldsService } from "./fields.service";

/**
 * 欄位管理(`system.field-manager`,#206)。
 * 只需要資料層的兩個 repository;稽核與權限解析分別由 @Global 的 AuditModule / PermissionModule 提供。
 */
@Module({
  imports: [DatabaseModule],
  providers: [FieldsService, FieldsResolver],
  exports: [FieldsService],
})
export class FieldsModule {}
