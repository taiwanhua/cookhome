import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";

import { useUserQuery } from "@repo/graphql";
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

export interface AssignRolesDialogProps {
  user: UserRow;
  /** 操作者自己的 id:角色清單 = 他自己持有的角色(防越權,ADR-0003) */
  operatorUserId: string;
  isSubmitting: boolean;
  errorCode: UserManagerErrorCode | null;
  onCancel: () => void;
  onConfirm: (roleIds: string[]) => void;
}

/**
 * 指派角色(Figma 86:245):全量覆蓋。
 * api 這一段沒有「角色清單」查詢(角色管理是第 4 段),所以清單改由 `user(自己的 id)` 的
 * `roles` 取得 — 它正好就是「操作者自己持有的角色 + 擁有組織」,與 api 的防越權同一份資料。
 */
export const AssignRolesDialog = ({
  user,
  operatorUserId,
  isSubmitting,
  errorCode,
  onCancel,
  onConfirm,
}: AssignRolesDialogProps) => {
  const t = useTranslations("admin.userManager.assignRoles");
  const tErrors = useTranslations("admin.userManager.errors");
  const { session } = useSession();

  const operator = useUserQuery(session.client, { id: operatorUserId });
  const options = useMemo(
    () => buildRoleOptions(operator.data?.user.roles ?? [], user.roles),
    [operator.data, user.roles],
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
