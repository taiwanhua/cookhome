import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";

import { useUsersQuery } from "@repo/graphql";
import { Alert } from "@repo/ui/alert";
import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { Checkbox } from "@repo/ui/checkbox";
import { Dialog } from "@repo/ui/dialog";
import { FormControlLabel } from "@repo/ui/form-control-label";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";
import { Typography } from "@repo/ui/typography";

import { usePermissions } from "@/hooks/usePermissions";
import { useSession } from "@/hooks/useSession";

import type { RoleManagerErrorCode } from "../role-manager-error";
import { USER_MANAGER_VIEW_PERMISSION } from "../role-manager-permissions";
import {
  ROLE_USER_CANDIDATES_PAGE_SIZE,
  type RoleRow,
} from "../role-manager-types";

export interface AddUsersDialogProps {
  role: RoleRow;
  isSubmitting: boolean;
  errorCode: RoleManagerErrorCode | null;
  onCancel: () => void;
  onConfirm: (userIds: readonly string[]) => void;
}

/**
 * 加入使用者(Figma 69:697)。候選 = 所屬組織落在角色擁有組織子樹內的使用者;
 * api 沒有專門的候選端點,借 `users` query 帶 `orgId = 角色的擁有組織`(ADR-0005:
 * 給 orgId 就是該組織的子樹)。最終資格仍由 api 判斷,候選外會回 `USER_NOT_ELIGIBLE`。
 */
export const AddUsersDialog = ({
  role,
  isSubmitting,
  errorCode,
  onCancel,
  onConfirm,
}: AddUsersDialogProps) => {
  const t = useTranslations("admin.roleManager.addUsers");
  const tErrors = useTranslations("admin.roleManager.errors");
  const { session } = useSession();
  const { hasPermission } = usePermissions();
  const [keyword, setKeyword] = useState("");
  const [pickedIds, setPickedIds] = useState<readonly string[]>([]);

  const canListUsers = hasPermission(USER_MANAGER_VIEW_PERMISSION);
  const ownerOrgId = role.ownerOrg?.id ?? null;

  const users = useUsersQuery(
    session.client,
    {
      input: {
        ...(ownerOrgId === null ? {} : { orgId: ownerOrgId }),
        page: 1,
        pageSize: ROLE_USER_CANDIDATES_PAGE_SIZE,
        keyword: keyword.trim() === "" ? null : keyword.trim(),
      },
    },
    { enabled: canListUsers },
  );
  const candidates = useMemo(
    () => users.data?.users.items ?? [],
    [users.data?.users.items],
  );

  const toggle = (userId: string) => {
    setPickedIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  };

  return (
    <Dialog
      open
      onClose={onCancel}
      fullWidth
      maxWidth="sm"
      title={t("title", {
        name: role.name,
        org: role.ownerOrg?.name ?? t("noOrg"),
      })}
      actions={
        <>
          <Button variant="text" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button
            disabled={pickedIds.length === 0 || isSubmitting}
            onClick={() => {
              onConfirm(pickedIds);
            }}
          >
            {t("confirm")}
          </Button>
        </>
      }
    >
      <Stack spacing={1.5}>
        {canListUsers ? (
          <>
            <TextField
              label={t("search")}
              placeholder={t("searchPlaceholder")}
              size="small"
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
              }}
            />
            <Box sx={{ maxHeight: 280, overflow: "auto" }}>
              {candidates.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  {t("empty")}
                </Typography>
              )}
              {candidates.map((candidate) => (
                <Box key={candidate.id}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={pickedIds.includes(candidate.id)}
                        onChange={() => {
                          toggle(candidate.id);
                        }}
                      />
                    }
                    label={t("candidate", {
                      account: candidate.account,
                      name: candidate.name,
                      orgs:
                        candidate.orgs.length === 0
                          ? t("noOrg")
                          : candidate.orgs.map((org) => org.name).join("、"),
                    })}
                  />
                </Box>
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t("hint", { org: role.ownerOrg?.name ?? t("noOrg") })}
            </Typography>
            <Typography variant="body2">
              {t("picked", { count: pickedIds.length })}
            </Typography>
          </>
        ) : (
          <Alert severity="info">{t("noUserPermission")}</Alert>
        )}
        {errorCode !== null && (
          <Alert severity="error">{tErrors(errorCode)}</Alert>
        )}
      </Stack>
    </Dialog>
  );
};
