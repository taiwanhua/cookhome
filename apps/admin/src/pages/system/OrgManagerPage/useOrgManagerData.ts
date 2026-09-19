import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useMeQuery, useOrgQuery, useOrgTreeQuery } from "@repo/graphql";

import { usePermissions } from "@/hooks/usePermissions";
import { useSession } from "@/hooks/useSession";
import { type OrgNodeLike, rootOrgId } from "@/lib/org-tree";

import { ORG_MANAGER_PERMISSIONS } from "./org-manager-permissions";
import type { OrgActionAbility } from "./org-manager-types";

/**
 * 組織管理頁的資料層:組織樹、選中組織的單筆資料、權限判斷與失效。
 *
 * **視角完全由資料決定**(#138 不做兩套頁):`orgTree` 的樹根在根組織視角是根組織
 * (`parentId === null`)、在租戶視角是租戶頂層(`parentId` 有值)。加上操作者有沒有
 * `tenant-ops.*` 那三筆權限,就足以決定畫面長什麼樣,不需要「我是不是超級管理員」這種旗標。
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
  const treeRootId = rootOrgId(orgNodes);
  /** 樹根的上層為 null = 操作者站在根組織(根組織視角);租戶視角的樹根是租戶頂層。 */
  const isRootPerspective =
    orgNodes.length > 0 && (orgNodes[0]?.parentId ?? null) === null;

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
    isRootPerspective,
    treeRootId,
    selectedOrgId,
    selectOrg: setPickedOrgId,
    org,
    isOrgLoading: selected.isLoading,
    invalidate,
  };
};
