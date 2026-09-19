import { useMemo } from "react";

import {
  type OrgNodeLike,
  type OrgOption,
  findOrgNode,
  flattenOrgs,
  orgTrail,
  platformRootOrgId,
} from "@/lib/org-tree";

export interface UseMoveTargetsOptions {
  nodes: readonly OrgNodeLike[];
  orgId: string | null;
}

/**
 * 「上層組織」下拉可以選誰(搬移,`docs/modules/org-manager.md`「搬移」)。
 * 候選 = **管理範圍內、同租戶、不在自己這棵子樹裡**;三條全在前端先擋掉,
 * api 仍會再驗一次(範圍外 `NOT_FOUND`、跨租戶 `CROSS_TENANT`、成環 `CYCLIC_MOVE`)。
 *
 * 1. **管理範圍**:樹上有的就是管理範圍(#187:範圍外的組織根本不回傳),所以只要在樹上走
 * 2. **同一個租戶**:從自己那一棵樹根往下的路徑上,租戶頂層是「平台根組織的直接子組織」—
 *    只有管理範圍是全部的人樹上才有平台根組織(`parentId` 為 null),此時要往下再走一層;
 *    其餘人的樹根本來就在單一租戶內,樹根即上限
 * 3. **不能搬進自己的子樹**(含自己)— 會把樹接成環
 */
export const useMoveTargets = ({
  nodes,
  orgId,
}: UseMoveTargetsOptions): OrgOption[] =>
  useMemo(() => {
    if (orgId === null) {
      return [];
    }
    const self = findOrgNode(nodes, orgId);
    const trail = orgTrail(nodes, orgId);
    if (self === null || trail.length === 0) {
      return [];
    }
    // 管理範圍多根時(#187),`trail[0]` 是含自己的那一棵樹的根
    const isUnderPlatformRoot = trail[0]?.id === platformRootOrgId(nodes);
    const tenantTopDepth = isUnderPlatformRoot ? 1 : 0;
    // 自己就是平台根組織時 `at(1)` 是 undefined:它不可搬(api 回 VALIDATION_FAILED),沒有候選
    const tenantTop = trail.at(tenantTopDepth);
    if (tenantTop === undefined) {
      return [];
    }
    const forbidden = new Set(flattenOrgs([self]).map((org) => org.id));
    return flattenOrgs([tenantTop]).filter(
      (option) => !forbidden.has(option.id) && !option.outOfScope,
    );
  }, [nodes, orgId]);
