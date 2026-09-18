import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { StorageModule } from "../storage/storage.module";
import { OrgsResolver } from "./orgs.resolver";
import { OrgsService } from "./orgs.service";

/**
 * 組織管理(`system.org-manager`,docs/modules/org-manager.md):樹查詢、新增子組織、編輯、
 * 停用 / 啟用連動、搬移、刪除前置。租戶作業(開通 / 轉移擁有者 / 可見範圍)另屬 `tenant-ops`(#135)。
 * AuditService / PermissionResolver 由 @Global 的 AuditModule / PermissionModule 提供,不必在此 import。
 */
@Module({
  imports: [DatabaseModule, StorageModule],
  providers: [OrgsService, OrgsResolver],
  exports: [OrgsService],
})
export class OrgsModule {}
