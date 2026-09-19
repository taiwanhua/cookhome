import { useMemo } from "react";

import {
  type OrgNodeLike,
  type OrgOption,
  findOrgNode,
  flattenOrgs,
  orgTrail,
} from "../../../lib/org-tree";

export interface UseMoveTargetsOptions {
  nodes: readonly OrgNodeLike[];
  /** 根組織視角時樹根是根組織,租戶頂層要往下再走一層 */
  isRootPerspective: boolean;
  orgId: string | null;
}

/**
 * 「上層組織」下拉可以選誰(搬移,`docs/modules/org-manager.md`「搬移」)。
 * 三條限制,全都在前端先擋掉,api 仍會再驗一次(`CROSS_TENANT` / `CYCLIC_MOVE`):
 *
 * 1. **同一個租戶**:從樹根到自己的路徑上,租戶頂層就是根組織視角的第 2 個、租戶視角的第 1 個;
 *    候選人限那一棵子樹
 * 2. **不能搬進自己的子樹**(含自己)— 會把樹接成環
 * 3. **可見範圍外的節點不能選**(ADR-0005:看得到不代表動得了)
 */
export const useMoveTargets = ({
  nodes,
  isRootPerspective,
  orgId,
}: UseMoveTargetsOptions): OrgOption[] =>
  useMemo(() => {
    if (orgId === null) {
      return [];
    }
    const self = findOrgNode(nodes, orgId);
    const trail = orgTrail(nodes, orgId);
    const tenantTopDepth = isRootPerspective ? 1 : 0;
    if (self === null || trail.length <= tenantTopDepth) {
      return [];
    }
    const tenantTop = trail[tenantTopDepth];
    const forbidden = new Set(flattenOrgs([self]).map((org) => org.id));
    return flattenOrgs([tenantTop]).filter(
      (option) => !forbidden.has(option.id) && !option.outOfScope,
    );
  }, [nodes, isRootPerspective, orgId]);
