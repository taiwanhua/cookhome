import { useTranslations } from "use-intl";

import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { Dialog } from "@repo/ui/dialog";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import type { UserManagerErrorCode } from "../user-manager-error";
import type { UserRow } from "../user-manager-types";

export interface ToggleEnabledDialogProps {
  user: UserRow;
  isSubmitting: boolean;
  errorCode: UserManagerErrorCode | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 停用 / 啟用確認:停用即刻作廢該使用者全部 refresh token(user-manager.md)。
 * 擁有者不可被停用,畫面上的按鈕已先 disabled,這裡再接一次 api 的 `OWNER_PROTECTED`。
 */
export const ToggleEnabledDialog = ({
  user,
  isSubmitting,
  errorCode,
  onCancel,
  onConfirm,
}: ToggleEnabledDialogProps) => {
  const t = useTranslations("admin.userManager.toggle");
  const tErrors = useTranslations("admin.userManager.errors");
  const isDisabling = user.enabled;

  return (
    <Dialog
      open
      onClose={onCancel}
      fullWidth
      maxWidth="xs"
      title={
        isDisabling
          ? t("disableTitle", { name: user.name })
          : t("enableTitle", { name: user.name })
      }
      actions={
        <>
          <Button variant="text" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button
            color={isDisabling ? "error" : "primary"}
            disabled={isSubmitting}
            onClick={onConfirm}
          >
            {isDisabling ? t("confirmDisable") : t("confirmEnable")}
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <Typography variant="body2">
          {isDisabling ? t("disableBody") : t("enableBody")}
        </Typography>
        {errorCode !== null && (
          <Alert severity="error">{tErrors(errorCode)}</Alert>
        )}
      </Stack>
    </Dialog>
  );
};
