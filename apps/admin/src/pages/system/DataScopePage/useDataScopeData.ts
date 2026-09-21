import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  useDataScopeRuleQuery,
  useDataScopeTargetsQuery,
  useOrgTreeQuery,
  useRolesQuery,
  useUsersQuery,
} from "@repo/graphql";

import { usePermissions } from "@/hooks/usePermissions";
import { useSession } from "@/hooks/useSession";
import { type OrgNodeLike, flattenOrgs } from "@/lib/org-tree";
import { roleMenuOptions } from "@/lib/role-options";

import {
  DATA_SCOPE_PERMISSIONS,
  ROLE_MANAGER_VIEW_PERMISSION,
  USER_MANAGER_VIEW_PERMISSION,
} from "./data-scope-permissions";
import type { PickerOption } from "./data-scope-types";

/** 選擇器的清單一次取滿(角色與使用者在單一租戶內都是小清單,不做分頁)。 */
const PICKER_PAGE = { page: 1, pageSize: 100 };

/**
 * 資料範圍頁的資料層:資料目標清單、每個目標「有沒有規則」、選中目標的規則,
 * 以及套用對象 / 條件值選擇器要用的角色、使用者、組織樹。
 *
 * **「有沒有規則」沒有現成欄位**:`dataScopeTargets` 只回目標與欄位目錄,所以這裡對每個目標
 * 各發一次 `dataScopeRule`(以 codegen 的 `getKey` / `fetcher` 併進 `useQueries`,與編輯器
 * 共用同一份快取,DATA-01 / 02)。資料目標是 seed 宣告的小清單,成本可接受;
 * 若日後目標變多,正解是 api 在 `DataScopeTarget` 上補一個 `hasRule`。
 */
export const useDataScopeData = () => {
  const { session } = useSession();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  const targets = useDataScopeTargetsQuery(session.client);
  const targetList = useMemo(
    () => targets.data?.dataScopeTargets.targets ?? [],
    [targets.data],
  );

  const [pickedCollection, setPickedCollection] = useState<string | null>(null);
  /** 還沒點過任何目標時預設選第一個(不在 effect 內 setState,REACT-06)。 */
  const firstCollection =
    targetList.length > 0 ? targetList[0].collection : null;
  const selectedCollection = pickedCollection ?? firstCollection;
  const selectedIndex = targetList.findIndex(
    (item) => item.collection === selectedCollection,
  );
  const target = selectedIndex === -1 ? undefined : targetList[selectedIndex];

  const ruleQueries = useQueries({
    queries: targetList.map((item) => ({
      queryKey: useDataScopeRuleQuery.getKey({ collection: item.collection }),
      queryFn: useDataScopeRuleQuery.fetcher(session.client, {
        collection: item.collection,
      }),
    })),
  });

  /** 規則本身帶著 `collection`,不必再跟目標清單對索引。 */
  const collectionsWithRule = new Set(
    ruleQueries
      .map((query) => query.data?.dataScopeRule.rule?.collection)
      .filter((collection): collection is string => collection !== undefined),
  );
  const selectedRule =
    selectedIndex === -1 ? undefined : ruleQueries[selectedIndex];

  const roles = useRolesQuery(
    session.client,
    { input: PICKER_PAGE },
    { enabled: hasPermission(ROLE_MANAGER_VIEW_PERMISSION) },
  );
  const users = useUsersQuery(
    session.client,
    { input: PICKER_PAGE },
    { enabled: hasPermission(USER_MANAGER_VIEW_PERMISSION) },
  );
  /** `orgTree` 只受管理範圍限制、沒有權限守門,所以不必 gate。 */
  const orgTree = useOrgTreeQuery(session.client);

  /**
   * 套用對象「指定角色」的選項:每列「角色名稱 — 擁有組織」,並帶租戶頂層供分組(#261 的 8)。
   * 每個租戶都有自己的「租戶管理員」,根組織視角只看角色名稱完全分不出來。
   */
  const roleOptions: PickerOption[] = roleMenuOptions(
    roles.data?.roles.items ?? [],
  ).map((role) => ({
    id: role.id,
    label: role.label,
    name: role.name,
    ownerOrgName: role.ownerOrgName,
    tenantTopId: role.tenantTopId,
    tenantTopName: role.tenantTopName,
  }));
  const userOptions: PickerOption[] = (users.data?.users.items ?? []).map(
    (user) => ({ id: user.id, label: `${user.name}(${user.account})` }),
  );
  const orgNodes = useMemo<readonly OrgNodeLike[]>(
    () => orgTree.data?.orgTree ?? [],
    [orgTree.data],
  );
  const orgOptions = useMemo(() => flattenOrgs(orgNodes), [orgNodes]);

  /** 儲存後精準失效(DATA-04):該目標的規則(編輯器 + 左清單的「已設規則」)與目標清單。 */
  const invalidate = async (collection: string) => {
    await queryClient.invalidateQueries({
      queryKey: useDataScopeRuleQuery.getKey({ collection }),
    });
    await queryClient.invalidateQueries({
      queryKey: useDataScopeTargetsQuery.getKey(),
    });
  };

  return {
    canEdit: hasPermission(DATA_SCOPE_PERMISSIONS.edit),
    targets: targetList,
    isTargetsLoading: targets.isLoading,
    collectionsWithRule,
    selectedCollection,
    selectTarget: setPickedCollection,
    target,
    rule: selectedRule?.data?.dataScopeRule.rule ?? null,
    isRuleLoading: selectedRule === undefined || selectedRule.isPending,
    roleOptions,
    userOptions,
    orgNodes,
    orgOptions,
    invalidate,
  };
};
