import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { OrgsModule } from "../orgs/orgs.module";
import { DataScopeResolver } from "./data-scope.resolver";
import { DataScopeService } from "./data-scope.service";

/**
 * 資料範圍(`system.data-scope`,#205 / ADR-0008)。
 *
 * 這個 module **必須被 AppModule 匯入**,不只是為了兩個 query 與一個 mutation:
 * `DataScopeService` 在 `onModuleInit` 把自己註冊成查詢中介層的規則提供者
 * (`database/plugins/data-scope-provider.ts`),規則的**執行**才會發生。
 *
 * 需要 OrgsModule 匯出的 `OwnerProtectionService`(`isRootOperator` — 根組織專屬的唯一判準,
 * 與租戶作業共用);稽核由 @Global 的 AuditModule、權限守門由 PermissionModule 提供。
 */
@Module({
  imports: [DatabaseModule, OrgsModule],
  providers: [DataScopeService, DataScopeResolver],
  exports: [DataScopeService],
})
export class DataScopeModule {}
