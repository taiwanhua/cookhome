import { useMemo, useState } from "react";

import {
  type RoleUsersQueryVariables,
  useGrantRoleUsersMutation,
  useRevokeRoleUsersMutation,
  useRoleUsersQuery,
} from "@repo/graphql";

import { useSession } from "@/hooks/useSession";

import {
  type RoleManagerErrorCode,
  roleManagerErrorOf,
} from "../role-manager-error";
import { ROLE_USERS_PAGE_SIZE, type RoleUserRow } from "../role-manager-types";

/**
 * 分配使用者頁籤的資料層:`roleUsers` 清單 + 增量加入 / 移除。
 * 清單含管理範圍外的「組織外」持有者(role-manager.md:列不出來就移不掉)。
 */
export const useRoleUsers = (roleId: string, onChanged: () => void) => {
  const { session } = useSession();
  const [page, setPage] = useState(1);
  const [errorCode, setErrorCode] = useState<RoleManagerErrorCode | null>(null);

  const variables = useMemo<RoleUsersQueryVariables>(
    () => ({ roleId, input: { page, pageSize: ROLE_USERS_PAGE_SIZE } }),
    [roleId, page],
  );
  const query = useRoleUsersQuery(session.client, variables);

  const onError = (error: unknown) => {
    setErrorCode(roleManagerErrorOf(error).code);
  };
  const onSuccess = () => {
    setErrorCode(null);
    onChanged();
  };

  const grant = useGrantRoleUsersMutation(session.client, {
    onSuccess,
    onError,
  });
  const revoke = useRevokeRoleUsersMutation(session.client, {
    onSuccess,
    onError,
  });

  const rows: readonly RoleUserRow[] = query.data?.roleUsers.items ?? [];

  return {
    rows,
    totalCount: query.data?.roleUsers.totalCount ?? 0,
    isLoading: query.isLoading,
    page,
    setPage,
    errorCode,
    clearError: () => {
      setErrorCode(null);
    },
    isSubmitting: grant.isPending || revoke.isPending,
    add: (userIds: readonly string[]) => {
      setErrorCode(null);
      grant.mutate({ input: { roleId, userIds: [...userIds] } });
    },
    remove: (userId: string) => {
      setErrorCode(null);
      revoke.mutate({ input: { roleId, userIds: [userId] } });
    },
  };
};
