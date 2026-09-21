import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";

import { useOrgTreeQuery, useRolesQuery } from "@repo/graphql";
import { Alert } from "@repo/ui/alert";
import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { Dialog } from "@repo/ui/dialog";
import { MenuItem } from "@repo/ui/menu";
import { Select } from "@repo/ui/select";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";
import { Typography } from "@repo/ui/typography";

import { useSession } from "@/hooks/useSession";
import { isEligibleForRole, orgTrailIndex } from "@/lib/role-eligibility";
import { filterRoleOptions, groupRoleOptions } from "@/lib/role-options";

import type { UserManagerErrorCode } from "../user-manager-error";
import type { UserRow } from "../user-manager-types";
import { RoleOptionRow } from "./RoleOptionRow";
import { buildRoleOptions, ownerOrgOptions } from "./assignable-roles";

/** 篩選器的「全部組織」。 */
const ALL_ORGS = "__all__";

/**
 * 彈窗一次把候選角色抓齊(api 上限 100,`RolesInput`)。角色是治理資料、數量遠小於
 * 使用者,分頁在這個彈窗裡只會讓「勾一勾按儲存」變成跨頁操作。
 */
const ROLES_PAGE_SIZE = 100;

export interface AssignRolesDialogProps {
  user: UserRow;
  isSubmitting: boolean;
  errorCode: UserManagerErrorCode | null;
  onCancel: () => void;
  onConfirm: (roleIds: string[]) => void;
}

/**
 * 指派角色(Figma 86:245):全量覆蓋。
 *
 * 候選來自正式的 `roles` query(#211;第 3 段拿「操作者自己持有的角色」當清單的過渡
 * 做法退場)—— 範圍是**擁有組織在操作者管理範圍內**,與 api 的 `assignUserRoles`、
 * 角色頁的 `grantRoleUsers` 同一條判準(ADR-0003 / ADR-0005)。
 *
 * #261 的兩件事:
 * - **沒有授予資格的角色顯示但 disabled** 並就地說明(在此之前勾得下去,送出才吃到錯)
 * - 每列標「角色名稱 — 擁有組織」,跨租戶時依 `ownerOrg.tenantTop` 分組並可搜尋 ——
 *   根組織視角下每個租戶都有一個「租戶管理員」,只看名稱分不出來
 */
export const AssignRolesDialog = ({
  user,
  isSubmitting,
  errorCode,
  onCancel,
  onConfirm,
}: AssignRolesDialogProps) => {
  const t = useTranslations("admin.userManager.assignRoles");
  const tErrors = useTranslations("admin.userManager.errors");
  const { session } = useSession();

  const rolesQuery = useRolesQuery(session.client, {
    input: { page: 1, pageSize: ROLES_PAGE_SIZE },
  });
  const orgTree = useOrgTreeQuery(session.client);
  const assignable = useMemo(
    () => rolesQuery.data?.roles.items ?? [],
    [rolesQuery.data],
  );
  const memberOrgIds = useMemo(
    () => user.orgs.map((org) => org.id),
    [user.orgs],
  );
  const options = useMemo(() => {
    const trails = orgTrailIndex(orgTree.data?.orgTree ?? []);
    return buildRoleOptions(assignable, user.roles, (ownerOrgId) =>
      isEligibleForRole(memberOrgIds, ownerOrgId, trails),
    );
  }, [assignable, user.roles, memberOrgIds, orgTree.data?.orgTree]);

  const [checkedIds, setCheckedIds] = useState<readonly string[]>(
    user.roles.map((role) => role.id),
  );
  const [orgFilter, setOrgFilter] = useState<string>(ALL_ORGS);
  const [keyword, setKeyword] = useState("");

  const orgs = ownerOrgOptions(options);
  const visible = filterRoleOptions(
    options.filter(
      (role) => orgFilter === ALL_ORGS || role.ownerOrgId === orgFilter,
    ),
    keyword,
  );
  const groups = groupRoleOptions(
    visible.map((role) => ({
      id: role.id,
      name: role.name,
      ownerOrgName: role.ownerOrgName,
      label: role.name,
      tenantTopId: role.tenantTopId,
      tenantTopName: role.tenantTopName,
    })),
  );
  const roleById = new Map(options.map((role) => [role.id, role]));

  const handleToggle = (roleId: string, isChecked: boolean) => {
    setCheckedIds((current) =>
      isChecked ? [...current, roleId] : current.filter((id) => id !== roleId),
    );
  };

  /** 只送操作者可觸及的角色(觸及不到的既有授予由 api 原樣保留)。 */
  const handleConfirm = () => {
    const reachable = new Set(
      options.filter((role) => !role.isOutOfReach).map((role) => role.id),
    );
    onConfirm(checkedIds.filter((id) => reachable.has(id)));
  };

  return (
    <Dialog
      open
      onClose={onCancel}
      fullWidth
      maxWidth="sm"
      title={t("title", { name: user.name })}
      actions={
        <>
          <Button variant="text" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button disabled={isSubmitting} onClick={handleConfirm}>
            {t("save")}
          </Button>
        </>
      }
    >
      <Stack spacing={1.75}>
        <Typography variant="caption" color="text.secondary">
          {t("hint", { name: user.name })}
        </Typography>

        <Stack direction="row" spacing={1}>
          <Select
            value={orgFilter}
            size="small"
            aria-label={t("orgFilter")}
            sx={{ flex: 1, minWidth: 0 }}
            onChange={(event) => {
              setOrgFilter(event.target.value);
            }}
          >
            <MenuItem value={ALL_ORGS}>{t("allOrgs")}</MenuItem>
            {orgs.map((org) => (
              <MenuItem key={org.id} value={org.id}>
                {org.name}
              </MenuItem>
            ))}
          </Select>
          <TextField
            label={t("search")}
            placeholder={t("searchPlaceholder")}
            size="small"
            value={keyword}
            sx={{ flex: 1, minWidth: 0 }}
            onChange={(event) => {
              setKeyword(event.target.value);
            }}
          />
        </Stack>

        {visible.length === 0 ? (
          <Typography variant="body2">{t("empty")}</Typography>
        ) : (
          groups.map((group) => (
            <Box key={group.id ?? ALL_ORGS}>
              {group.name !== null && (
                <Typography
                  variant="overline"
                  color="text.secondary"
                  component="p"
                >
                  {group.name}
                </Typography>
              )}
              {group.options.flatMap((option) => {
                const role = roleById.get(option.id);
                return role === undefined
                  ? []
                  : [
                      <RoleOptionRow
                        key={role.id}
                        role={role}
                        userName={user.name}
                        isChecked={checkedIds.includes(role.id)}
                        onToggle={handleToggle}
                      />,
                    ];
              })}
            </Box>
          ))
        )}

        {errorCode !== null && (
          <Alert severity="error">{tErrors(errorCode)}</Alert>
        )}
      </Stack>
    </Dialog>
  );
};
