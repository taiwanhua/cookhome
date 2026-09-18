import { Module } from "@nestjs/common";
import { Query, Resolver } from "@nestjs/graphql";

import { RequirePermission } from "../require-permission.decorator";

/** 探針端點要求的權限 key(示範模組1 的「編輯」)。 */
export const PROBE_PERMISSION_KEY = "demo.sub.sample-one.edit";

/**
 * 測試專用探針(不進 build:tsconfig.build.json 排除 test-support):
 * 目前沒有任何正式端點需要權限,守門行為只能靠這支標了 `@RequirePermission` 的 query 經 GraphQL 驗證。
 */
@Resolver()
export class PermissionProbeResolver {
  @RequirePermission(PROBE_PERMISSION_KEY)
  @Query(() => Boolean, { name: "permissionProbe" })
  probe(): boolean {
    return true;
  }
}

@Module({ providers: [PermissionProbeResolver] })
export class PermissionProbeModule {}
