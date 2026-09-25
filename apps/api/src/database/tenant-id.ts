import type { Types } from "mongoose";

/** 推導租戶 id 需要的組織形狀(物化路徑,ADR-0005)。 */
export interface OrgAncestry {
  _id: Types.ObjectId;
  /** `[根, 租戶頂層, …]`;根組織為空陣列。 */
  ancestors: readonly Types.ObjectId[];
}

/**
 * 一個組織所屬的**租戶 id**(= 租戶頂層 `orgs` id);根組織與它自己的資料為 `null`。
 *
 * - 根組織(`ancestors` 為空)→ `null`:根組織不屬於任何租戶
 * - 租戶頂層(`ancestors` 只有根組織)→ 自己
 * - 更下層 → `ancestors[1]`
 *
 * 與 `orgs/org-mapper.ts` 的 `tenantTopIdOf` 差在根組織:那支給分組用、根組織回自己;
 * 這支給模組資料的 `tenantId` 與 `business_relationships` 的租戶邊界用,根組織必須是 `null`,
 * 否則根組織的資料會被當成某一個「租戶」。
 */
export function tenantIdOfOrg(org: OrgAncestry): Types.ObjectId | null {
  if (org.ancestors.length === 0) {
    return null;
  }
  return org.ancestors[1] ?? org._id;
}
