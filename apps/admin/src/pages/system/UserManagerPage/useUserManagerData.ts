import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  type UsersQueryVariables,
  useOrgQuery,
  useOrgTreeQuery,
  useUserQuery,
  useUsersQuery,
} from "@repo/graphql";

import { usePermissions } from "../../../hooks/usePermissions";
import { useSession } from "../../../hooks/useSession";
import { type OrgNodeLike, rootOrgId } from "../../../lib/org-tree";
import {
  ORG_MANAGER_VIEW_PERMISSION,
  USER_MANAGER_PERMISSIONS,
} from "./user-manager-permissions";
import {
  USERS_PAGE_SIZE,
  type UserActionAbility,
  type UserRow,
} from "./user-manager-types";

/**
 * 使用者管理頁的資料層:組織樹、清單、篩選與權限判斷(ADR-0011「頁內功能」)。
 *
 * 組織樹來自 `orgTree`,而 api 把它掛在 `system.org-manager.view` 底下 — 沒有那個權限時
 * 不送查詢,清單改成「不給 orgId」= 攤開整個可見範圍(治理模組慣例,ADR-0005)。
 *
 * 擁有者保護(ADR-0009)在前端只需要一個 id:樹根就是「租戶頂層」(租戶視角)或「根組織」
 * (根組織視角)。樹根 `parentId === null` 代表操作者站在根組織 — 一律放行,不標保護;
 * 否則樹根的 `ownerUserId` 就是受保護的那一位。
 */
export const useUserManagerData = () => {
  const { session } = useSession();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  const ability: UserActionAbility = {
    canCreate: hasPermission(USER_MANAGER_PERMISSIONS.create),
    canEdit: hasPermission(USER_MANAGER_PERMISSIONS.edit),
    canManageOrgs: hasPermission(USER_MANAGER_PERMISSIONS.manageOrgs),
    canAssignRoles: hasPermission(USER_MANAGER_PERMISSIONS.assignRoles),
    canToggleEnabled: hasPermission(USER_MANAGER_PERMISSIONS.toggleEnabled),
    canShowNationalId: hasPermission(USER_MANAGER_PERMISSIONS.showNationalId),
    canEditNationalId: hasPermission(USER_MANAGER_PERMISSIONS.editNationalId),
  };
  const isOrgTreeAvailable = hasPermission(ORG_MANAGER_VIEW_PERMISSION);

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [keyword, setKeywordValue] = useState("");
  const [page, setPage] = useState(1);

  const orgTree = useOrgTreeQuery(session.client, undefined, {
    enabled: isOrgTreeAvailable,
  });
  const orgNodes: readonly OrgNodeLike[] = orgTree.data?.orgTree ?? [];
  const treeRootId = rootOrgId(orgNodes);

  const treeRoot = useOrgQuery(
    session.client,
    { id: treeRootId ?? "" },
    { enabled: isOrgTreeAvailable && treeRootId !== null },
  );
  const rootOrg = treeRoot.data?.org;
  const protectedOwnerUserId =
    rootOrg === undefined || rootOrg.parentId === null
      ? null
      : (rootOrg.ownerUserId ?? null);

  const usersVariables = useMemo<UsersQueryVariables>(
    () => ({
      input: {
        orgId: selectedOrgId,
        page,
        pageSize: USERS_PAGE_SIZE,
        keyword: keyword.trim() === "" ? null : keyword.trim(),
      },
    }),
    [selectedOrgId, page, keyword],
  );
  const users = useUsersQuery(session.client, usersVariables);

  const rows: readonly UserRow[] = users.data?.users.items ?? [];
  const totalCount = users.data?.users.totalCount ?? 0;

  /** 換組織 / 換關鍵字都回到第一頁(否則會停在一個不存在的頁碼上看到空清單)。 */
  const selectOrg = (orgId: string | null) => {
    setSelectedOrgId(orgId);
    setPage(1);
  };
  const setKeyword = (value: string) => {
    setKeywordValue(value);
    setPage(1);
  };

  /** 寫入成功後精準失效(DATA-02 / 04):目前這份清單 + 被改到的那一筆單筆。 */
  const invalidate = async (userId?: string) => {
    await queryClient.invalidateQueries({
      queryKey: useUsersQuery.getKey(usersVariables),
    });
    if (userId !== undefined) {
      await queryClient.invalidateQueries({
        queryKey: useUserQuery.getKey({ id: userId }),
      });
    }
  };

  return {
    ability,
    isOrgTreeAvailable,
    orgNodes,
    isOrgTreeLoading: orgTree.isLoading,
    protectedOwnerUserId,
    selectedOrgId,
    selectOrg,
    keyword,
    setKeyword,
    page,
    setPage,
    rows,
    totalCount,
    isUsersLoading: users.isLoading,
    invalidate,
  };
};
