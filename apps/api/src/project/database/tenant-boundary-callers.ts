import type { TenantBoundaryContextPurpose } from "../../database/tenant-boundary-purposes";

/**
 * 專案裡**允許呼叫租戶邊界出口(`BaseRepository.existsInTenant` / `findRefsInTenant`)的檔案**
 * (相對 `apps/api/src/`;規則與底座清單見 `database/base.repository.ts` 的 `TENANT_BOUNDARY_CALLERS`)。
 * `database/exists-any-callers.test.ts` 合併兩份清單掃整個 src;這份只能列 `project/` 的檔案。
 */
export const PROJECT_TENANT_BOUNDARY_CALLERS: readonly string[] = [];

/**
 * 專案裡**允許呼叫 `tenantBoundaryContext` 的檔案**與用途(規則與底座清單見
 * `database/tenant-boundary-context.ts` 的 `TENANT_BOUNDARY_CONTEXT_CALLERS`)。
 * `database/tenant-boundary-context.test.ts` 合併兩份清單掃 src;這份只能列 `project/` 的檔案。
 */
export const PROJECT_TENANT_BOUNDARY_CONTEXT_CALLERS: Readonly<
  Record<string, readonly TenantBoundaryContextPurpose[]>
> = {};
