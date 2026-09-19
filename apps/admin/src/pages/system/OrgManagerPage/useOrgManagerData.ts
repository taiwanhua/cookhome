import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useMeQuery, useOrgQuery, useOrgTreeQuery } from "@repo/graphql";

import { usePermissions } from "@/hooks/usePermissions";
import { useSession } from "@/hooks/useSession";
import {
  type OrgNodeLike,
  firstRootOrgId,
  platformRootOrgId,
} from "@/lib/org-tree";

import { ORG_MANAGER_PERMISSIONS } from "./org-manager-permissions";
import type { OrgActionAbility } from "./org-manager-types";

/**
 * 組織管理頁的資料層:組織樹、選中組織的單筆資料、權限判斷與失效。
 *
 * **視角完全由資料決定**(#138 不做兩套頁):`orgTree` 回的是操作者的**管理範圍**
 * (#187),根可能有**多個**;只有管理範圍是全部的人樹上才有平台根組織
 * (唯一 `parentId === null` 的節點)。加上操作者有沒有 `tenant-ops` 的權限,
 * 就足以決定畫面長什麼樣,不需要「我是不是超級管理員」這種旗標。
 */
export const useOrgManagerData = () => {
  const { session } = useSession();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  const ability: OrgActionAbility = {
    canCreateChild: hasPermission(ORG_MANAGER_PERMISSIONS.createChild),
    canEdit: hasPermission(ORG_MANAGER_PERMISSIONS.edit),
    canToggleEnabled: hasPermission(ORG_MANAGER_PERMISSIONS.toggleEnabled),
    canMove: hasPermission(ORG_MANAGER_PERMISSIONS.move),
    canDelete: hasPermission(ORG_MANAGER_PERMISSIONS.delete),
    canProvision: hasPermission(ORG_MANAGER_PERMISSIONS.provision),
    canTransferOwner: hasPermission(ORG_MANAGER_PERMISSIONS.transferOwner),
    canSetVisibility: hasPermission(ORG_MANAGER_PERMISSIONS.setVisibility),
  };

  const [pickedOrgId, setPickedOrgId] = useState<string | null>(null);

  const orgTree = useOrgTreeQuery(session.client);
  const orgNodes: readonly OrgNodeLike[] = orgTree.data?.orgTree ?? [];
  const treeRootId = firstRootOrgId(orgNodes);
  /**
   * 平台根組織的 id:在樹上 = 根組織視角(管理範圍是全部),不在 = 租戶 / 部門視角。
   * 「租戶」標籤與搬移候選的租戶上限都靠它判(`OrgTreePanel` / `useMoveTargets`)。
   */
  const rootOrgId = platformRootOrgId(orgNodes);

  /** 還沒點過任何節點時預設選樹根(不在 effect 內 setState,REACT-06)。 */
  const selectedOrgId = pickedOrgId ?? treeRootId;

  const selected = useOrgQuery(
    session.client,
    { id: selectedOrgId ?? "" },
    { enabled: selectedOrgId !== null },
  );
  const org = selected.data?.org;

  /** 寫入成功後精準失效(DATA-02 / 04):樹、被改到的那一筆、以及 `me`(商標 / 組織名進側欄)。 */
  const invalidate = async (orgId?: string) => {
    await queryClient.invalidateQueries({ queryKey: useOrgTreeQuery.getKey() });
    await queryClient.invalidateQueries({
      queryKey: useOrgQuery.getKey({ id: orgId ?? selectedOrgId ?? "" }),
    });
    await queryClient.invalidateQueries({ queryKey: useMeQuery.getKey() });
  };

  return {
    ability,
    orgNodes,
    isOrgTreeLoading: orgTree.isLoading,
    rootOrgId,
    treeRootId,
    selectedOrgId,
    selectOrg: setPickedOrgId,
    org,
    isOrgLoading: selected.isLoading,
    invalidate,
  };
};
