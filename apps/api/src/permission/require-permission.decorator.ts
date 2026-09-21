import { SetMetadata, UseGuards, applyDecorators } from "@nestjs/common";

import { splitPermissionKey } from "@repo/domain/permission";

import { PermissionGuard, REQUIRED_PERMISSION_KEY } from "./permission.guard";

/**
 * 標註 resolver 所需的權限 key(ADR-0011「API 防守」:重用頁面權限 key)。
 * 判斷「key 在有效權限集合中,或擁有模組 key + `.*` 在集合中」(ADR-0004 同層語意);
 * 無權回 `FORBIDDEN`;未標註者維持登入線1 的「已登入即可」。
 *
 * 守門以 `UseGuards` 掛在方法 / 類別層:Nest 固定先跑全域 guard(AuthGuard)再跑方法層 guard,
 * 未登入必定先得到 `UNAUTHENTICATED`,順序不依賴 module 註冊次序。
 * key 形狀在裝飾當下驗證(不合法 → 啟動即失敗)。
 */
export const RequirePermission = (
  key: string,
): MethodDecorator & ClassDecorator => {
  splitPermissionKey(key);
  return applyDecorators(
    SetMetadata(REQUIRED_PERMISSION_KEY, key),
    UseGuards(PermissionGuard),
  );
};
