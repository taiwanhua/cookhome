import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";

import { useRolesQuery } from "@repo/graphql";
import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { Dialog } from "@repo/ui/dialog";
import { MenuItem } from "@repo/ui/menu";
import { Select } from "@repo/ui/select";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import { useSession } from "@/hooks/useSession";

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
  const assignable = useMemo(
    () => rolesQuery.data?.roles.items ?? [],
    [rolesQuery.data],
  );
  const options = useMemo(
    () => buildRoleOptions(assignable, user.roles),
    [assignable, user.roles],
  );

  const [checkedIds, setCheckedIds] = useState<readonly string[]>(
    user.roles.map((role) => role.id),
  );
  const [orgFilter, setOrgFilter] = useState<string>(ALL_ORGS);

  const orgs = ownerOrgOptions(options);
  const visible = options.filter(
    (role) => orgFilter === ALL_ORGS || role.ownerOrgId === orgFilter,
  );

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

        <Select
          value={orgFilter}
          size="small"
          aria-label={t("orgFilter")}
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

        {visible.length === 0 ? (
          <Typography variant="body2">{t("empty")}</Typography>
        ) : (
          visible.map((role) => (
            <RoleOptionRow
              key={role.id}
              role={role}
              isChecked={checkedIds.includes(role.id)}
              onToggle={handleToggle}
            />
          ))
        )}

        {errorCode !== null && (
          <Alert severity="error">{tErrors(errorCode)}</Alert>
        )}
      </Stack>
    </Dialog>
  );
};
