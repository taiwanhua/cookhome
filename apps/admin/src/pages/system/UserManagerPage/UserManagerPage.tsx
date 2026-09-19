import { useState } from "react";
import { useTranslations } from "use-intl";

import {
  useAssignUserRolesMutation,
  useSetUserEnabledMutation,
} from "@repo/graphql";
import { Card } from "@repo/ui/card";
import { Pagination } from "@repo/ui/pagination";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import { useMe } from "../../../hooks/useMe";
import { useSession } from "../../../hooks/useSession";
import { AssignRolesDialog } from "./AssignRolesDialog/AssignRolesDialog";
import { OrgChangeDialog } from "./OrgChangeDialog/OrgChangeDialog";
import { OrgPickerDialog } from "./OrgPickerDialog/OrgPickerDialog";
import { OrgTreePanel } from "./OrgTreePanel";
import { ToggleEnabledDialog } from "./ToggleEnabledDialog/ToggleEnabledDialog";
import { UserFormDialog } from "./UserFormDialog/UserFormDialog";
import { UserTable } from "./UserTable/UserTable";
import { UserToolbar } from "./UserToolbar";
import { useUserManagerData } from "./useUserManagerData";
import { useUserOrgsFlow } from "./useUserOrgsFlow";
import {
  type UserManagerErrorCode,
  userManagerErrorOf,
} from "./user-manager-error";
import { USERS_PAGE_SIZE, type UserRow } from "./user-manager-types";

/**
 * 使用者管理(模組 key `system.user-manager`,正本 `docs/modules/user-manager.md`;
 * Figma「Screen / Admin 使用者管理」30:105)。
 * 左組織樹選範圍 → 右分頁清單;所有動作都是這一頁上的彈窗,顯示與否依權限(ADR-0011)。
 */
export const UserManagerPage = () => {
  const t = useTranslations("admin.userManager");
  const tErrors = useTranslations("admin.userManager.errors");
  const { session } = useSession();
  const me = useMe();
  const data = useUserManagerData();

  /** 表單彈窗:null = 沒開;`{ user: null }` = 新增;`{ user }` = 編輯 */
  const [formTarget, setFormTarget] = useState<{ user: UserRow | null } | null>(
    null,
  );
  const [rolesUser, setRolesUser] = useState<UserRow | null>(null);
  const [toggleUser, setToggleUser] = useState<UserRow | null>(null);
  const [actionError, setActionError] = useState<UserManagerErrorCode | null>(
    null,
  );

  const orgsFlow = useUserOrgsFlow((userId) => {
    void data.invalidate(userId);
  });

  const onActionError = (error: unknown) => {
    setActionError(userManagerErrorOf(error).code);
  };

  const setUserEnabled = useSetUserEnabledMutation(session.client, {
    onSuccess: (payload) => {
      setToggleUser(null);
      void data.invalidate(payload.setUserEnabled.user.id);
    },
    onError: onActionError,
  });

  const assignRoles = useAssignUserRolesMutation(session.client, {
    onSuccess: (payload) => {
      setRolesUser(null);
      void data.invalidate(payload.assignUserRoles.user.id);
    },
    onError: onActionError,
  });

  const pageCount = Math.max(1, Math.ceil(data.totalCount / USERS_PAGE_SIZE));

  return (
    <Stack direction="row" spacing={3} sx={{ alignItems: "flex-start" }}>
      <OrgTreePanel
        nodes={data.orgNodes}
        isLoading={data.isOrgTreeLoading}
        isAvailable={data.isOrgTreeAvailable}
        selectedOrgId={data.selectedOrgId}
        onSelectOrg={data.selectOrg}
      />

      <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
        <UserToolbar
          keyword={data.keyword}
          onKeywordChange={data.setKeyword}
          canCreate={data.ability.canCreate}
          onCreate={() => {
            setFormTarget({ user: null });
          }}
        />
        <Typography variant="caption" color="text.secondary">
          {t("outOfScopeHint")}
        </Typography>
        <Card>
          <UserTable
            rows={data.rows}
            isLoading={data.isUsersLoading}
            ability={data.ability}
            protectedOwnerUserId={data.protectedOwnerUserId}
            isOrgTreeAvailable={data.isOrgTreeAvailable}
            onEdit={(user) => {
              setFormTarget({ user });
            }}
            onManageOrgs={orgsFlow.open}
            onAssignRoles={setRolesUser}
            onToggleEnabled={(user) => {
              setActionError(null);
              setToggleUser(user);
            }}
          />
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", px: 3, py: 1.5 }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              {t("total", {
                total: data.totalCount,
                pageSize: USERS_PAGE_SIZE,
              })}
            </Typography>
            <Pagination
              count={pageCount}
              page={data.page}
              onChange={(_event, nextPage) => {
                data.setPage(nextPage);
              }}
            />
          </Stack>
        </Card>
        {actionError !== null && toggleUser === null && rolesUser === null && (
          <Typography variant="body2" color="error.main">
            {tErrors(actionError)}
          </Typography>
        )}
      </Stack>

      {formTarget !== null && (
        <UserFormDialog
          user={formTarget.user}
          defaultOrgIds={
            data.selectedOrgId === null ? [] : [data.selectedOrgId]
          }
          orgNodes={data.orgNodes}
          isOrgTreeAvailable={data.isOrgTreeAvailable}
          ability={data.ability}
          onClose={() => {
            setFormTarget(null);
          }}
          onSaved={() => {
            void data.invalidate(formTarget.user?.id);
            setFormTarget(null);
          }}
        />
      )}

      {orgsFlow.flow?.stage === "picker" && (
        <OrgPickerDialog
          title={t("orgPicker.title", { name: orgsFlow.flow.user.name })}
          nodes={data.orgNodes}
          isLoading={data.isOrgTreeLoading}
          initialSelectedIds={orgsFlow.flow.user.orgs.map((org) => org.id)}
          isSubmitting={orgsFlow.isSubmitting}
          onCancel={orgsFlow.close}
          onConfirm={orgsFlow.pick}
        />
      )}

      {orgsFlow.flow?.stage === "confirm" && (
        <OrgChangeDialog
          userName={orgsFlow.flow.user.name}
          preview={orgsFlow.flow.preview}
          isSubmitting={orgsFlow.isSubmitting}
          errorCode={orgsFlow.errorCode}
          onCancel={orgsFlow.close}
          onConfirm={orgsFlow.confirm}
        />
      )}

      {rolesUser !== null && me.data !== undefined && (
        <AssignRolesDialog
          user={rolesUser}
          operatorUserId={me.data.me.id}
          isSubmitting={assignRoles.isPending}
          errorCode={actionError}
          onCancel={() => {
            setActionError(null);
            setRolesUser(null);
          }}
          onConfirm={(roleIds) => {
            setActionError(null);
            assignRoles.mutate({ input: { userId: rolesUser.id, roleIds } });
          }}
        />
      )}

      {toggleUser !== null && (
        <ToggleEnabledDialog
          user={toggleUser}
          isSubmitting={setUserEnabled.isPending}
          errorCode={actionError}
          onCancel={() => {
            setActionError(null);
            setToggleUser(null);
          }}
          onConfirm={() => {
            setActionError(null);
            setUserEnabled.mutate({
              input: { id: toggleUser.id, enabled: !toggleUser.enabled },
            });
          }}
        />
      )}
    </Stack>
  );
};
