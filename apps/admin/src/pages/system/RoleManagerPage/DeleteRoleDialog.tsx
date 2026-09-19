import { useTranslations } from "use-intl";

import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { Dialog } from "@repo/ui/dialog";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import type {
  RoleManagerErrorCode,
  RoleNotDeletableReason,
} from "./role-manager-error";
import type { RoleRow } from "./role-manager-types";

export interface DeleteRoleDialogProps {
  role: RoleRow;
  isSubmitting: boolean;
  errorCode: RoleManagerErrorCode | null;
  /** `ROLE_NOT_DELETABLE` 時 api 逐項回報為什麼不能刪 */
  reasons: readonly RoleNotDeletableReason[];
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 刪除確認(Figma 57:720)。三個前置檢查(無授予 / 非種子角色 / 非租戶副本)在 api,
 * 前端不預判 — 送出後收到 `ROLE_NOT_DELETABLE` 才把 `reasons` 攤成清單並提示改用停用。
 */
export const DeleteRoleDialog = ({
  role,
  isSubmitting,
  errorCode,
  reasons,
  onCancel,
  onConfirm,
}: DeleteRoleDialogProps) => {
  const t = useTranslations("admin.roleManager.delete");
  const tForm = useTranslations("admin.roleManager.form");
  const tErrors = useTranslations("admin.roleManager.errors");
  const isBlocked = reasons.length > 0;

  return (
    <Dialog
      open
      onClose={onCancel}
      fullWidth
      maxWidth="xs"
      title={t("title", { name: role.name })}
      actions={
        <>
          <Button variant="text" onClick={onCancel}>
            {isBlocked ? t("close") : tForm("cancel")}
          </Button>
          {!isBlocked && (
            <Button color="error" disabled={isSubmitting} onClick={onConfirm}>
              {t("confirm")}
            </Button>
          )}
        </>
      }
    >
      <Stack spacing={2}>
        {isBlocked ? (
          <>
            <Typography variant="body2">{t("blocked")}</Typography>
            <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 3 }}>
              {reasons.map((reason) => (
                <Typography key={reason} component="li" variant="body2">
                  {t(`reasons.${reason}`)}
                </Typography>
              ))}
            </Stack>
            <Alert severity="info">{t("useDisableInstead")}</Alert>
          </>
        ) : (
          <Typography variant="body2">{t("body")}</Typography>
        )}
        {errorCode !== null && !isBlocked && (
          <Alert severity="error">{tErrors(errorCode)}</Alert>
        )}
      </Stack>
    </Dialog>
  );
};
