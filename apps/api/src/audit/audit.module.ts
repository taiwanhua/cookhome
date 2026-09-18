import { Global, Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { AuditService } from "./audit.service";

/**
 * 稽核(ADR-0004):`AuditService.record(...)` 供各功能模組層在寫入動作後呼叫。
 * 標 @Global:本段起每個治理模組都要記稽核(組織管理、使用者管理…),
 * 不必每個功能模組重複 import(與 PermissionModule 同理)。
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
