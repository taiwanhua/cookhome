import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { OrgQualificationService } from "./org-qualification.service";
import { OwnerProtectionService } from "./owner-protection.service";
import { UsersResolver } from "./users.resolver";
import { UsersService } from "./users.service";

/**
 * 使用者管理(`system.user-manager`,#136)。
 * 需要 AuthModule 匯出的 `AuthService`(停用時作廢 refresh token)與
 * `PasswordService`(啟用信);稽核與權限解析分別由 @Global 的 AuditModule / PermissionModule 提供。
 */
@Module({
  imports: [DatabaseModule, AuthModule],
  providers: [
    UsersService,
    UsersResolver,
    OrgQualificationService,
    OwnerProtectionService,
  ],
  exports: [UsersService],
})
export class UsersModule {}
