import mongoose, { type Types } from "mongoose";

import { TenantScopeError } from "./plugins/tenant-scope.plugin";

/**
 * 以 `tenantId` 為邊界的 repository(不掛可見範圍插件的表:`workflows`、`workflow_tasks`)共用的斷言。
 * 寫法與 `business-relationships.repository.ts` 同一個精神:**每個讀寫方法都要明給邊界**,
 * 沒給就拋 `TenantScopeError`(fail-closed),不會靜默查出全部。
 */

/** 一定要是租戶頂層 id(ObjectId);`null` / `undefined` / 其他型別一律拋錯。 */
export function assertTenantBoundary(
  tenantId: Types.ObjectId | null | undefined,
  collection: string,
): Types.ObjectId {
  if (!(tenantId instanceof mongoose.Types.ObjectId)) {
    throw new TenantScopeError(
      `${collection} 的每個讀寫都必須帶 tenantId(以租戶為邊界)`,
    );
  }
  return tenantId;
}

/**
 * 租戶頂層 id,或**明給的 `null`**(= 共用資料,root 管)。`undefined` 或其他型別拋錯 ——
 * 「忘了給」與「刻意查共用」在呼叫端必須寫得出差別。
 */
export function assertTenantOrShared(
  tenantId: Types.ObjectId | null | undefined,
  collection: string,
): Types.ObjectId | null {
  if (tenantId === null) {
    return null;
  }
  return assertTenantBoundary(tenantId, collection);
}
