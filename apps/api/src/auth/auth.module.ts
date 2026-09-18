import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { DatabaseModule } from "../database/database.module";
import { authConfigProvider } from "./auth.config";
import { AuthGuard } from "./auth.guard";
import { AuthResolver } from "./auth.resolver";
import { AuthService } from "./auth.service";
import { LoginThrottle } from "./login-throttle";
import { OperatorContextService } from "./operator-context.service";
import { RefreshCookie } from "./refresh-cookie";
import { TokenService } from "./token.service";

/** 登入線(#61 第 2 段):登入 / token 生命週期 / 全域登入守門與操作者上下文。 */
@Module({
  imports: [DatabaseModule],
  providers: [
    authConfigProvider,
    TokenService,
    LoginThrottle,
    RefreshCookie,
    OperatorContextService,
    AuthService,
    AuthResolver,
    // 全域 guard:未標 @Public() 的 resolver 一律要求已登入
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService, OperatorContextService],
})
export class AuthModule {}
