import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  type RolesQueryVariables,
  useRoleMatrixQuery,
  useRoleUsersQuery,
  useRolesQuery,
} from "@repo/graphql";

import { usePermissions } from "@/hooks/usePermissions";
import { useSession } from "@/hooks/useSession";

import { ROLE_MANAGER_PERMISSIONS } from "./role-manager-permissions";
import {
  ROLES_PAGE_SIZE,
  ROLE_USERS_PAGE_SIZE,
  type RoleActionAbility,
  type RoleRow,
} from "./role-manager-types";

/**
 * 角色管理頁的資料層:清單、搜尋、分頁、選中的角色與權限判斷(ADR-0011「頁內功能」)。
 *
 * 清單範圍由 api 決定(擁有組織在操作者管理範圍內,ADR-0003),前端不再過濾。
 * 選中的角色是**衍生**的:清單上找得到就用清單那一筆,否則退回第一筆 —
 * 換頁 / 搜尋後不必在 effect 內改 state(REACT-06)。
 */
export const useRoleManagerData = () => {
  const { session } = useSession();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  const ability: RoleActionAbility = {
    canView: hasPermission(ROLE_MANAGER_PERMISSIONS.view),
    canCreate: hasPermission(ROLE_MANAGER_PERMISSIONS.create),
    canEdit: hasPermission(ROLE_MANAGER_PERMISSIONS.edit),
    canEditMatrix: hasPermission(ROLE_MANAGER_PERMISSIONS.editMatrix),
    canAssignUsers: hasPermission(ROLE_MANAGER_PERMISSIONS.assignUsers),
    canToggleEnabled: hasPermission(ROLE_MANAGER_PERMISSIONS.toggleEnabled),
    canDelete: hasPermission(ROLE_MANAGER_PERMISSIONS.delete),
  };

  const [keyword, setKeywordValue] = useState("");
  const [page, setPage] = useState(1);
  const [pickedRoleId, setPickedRoleId] = useState<string | null>(null);

  const rolesVariables = useMemo<RolesQueryVariables>(
    () => ({
      input: {
        page,
        pageSize: ROLES_PAGE_SIZE,
        keyword: keyword.trim() === "" ? null : keyword.trim(),
      },
    }),
    [page, keyword],
  );
  const roles = useRolesQuery(session.client, rolesVariables, {
    enabled: ability.canView,
  });

  const rows: readonly RoleRow[] = roles.data?.roles.items ?? [];
  const totalCount = roles.data?.roles.totalCount ?? 0;
  const selectedRole =
    rows.find((role) => role.id === pickedRoleId) ?? rows.at(0) ?? null;

  /** 換關鍵字回到第一頁(否則會停在一個不存在的頁碼上看到空清單)。 */
  const setKeyword = (value: string) => {
    setKeywordValue(value);
    setPage(1);
  };

  /** 寫入成功後精準失效(DATA-02 / 04):清單 + 被改到那筆角色的矩陣與持有人清單。 */
  const invalidate = async (roleId?: string) => {
    await queryClient.invalidateQueries({
      queryKey: useRolesQuery.getKey(rolesVariables),
    });
    if (roleId !== undefined) {
      await queryClient.invalidateQueries({
        queryKey: useRoleMatrixQuery.getKey({ roleId }),
      });
      // RoleUsers 的 key 還帶分頁,取 codegen key 的第一段當前綴,一次掃掉各頁(DATA-02)
      await queryClient.invalidateQueries({
        queryKey: useRoleUsersQuery
          .getKey({
            roleId,
            input: { page: 1, pageSize: ROLE_USERS_PAGE_SIZE },
          })
          .slice(0, 1),
        exact: false,
      });
    }
  };

  return {
    ability,
    rows,
    totalCount,
    isLoading: roles.isLoading,
    keyword,
    setKeyword,
    page,
    setPage,
    selectedRole,
    selectRole: setPickedRoleId,
    invalidate,
  };
};
