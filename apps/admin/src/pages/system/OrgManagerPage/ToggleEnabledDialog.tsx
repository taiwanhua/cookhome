import { useTranslations } from "use-intl";

import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { Dialog } from "@repo/ui/dialog";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import type { OrgManagerErrorCode } from "./org-manager-error";
import type { OrgDetail } from "./org-manager-types";

export interface ToggleEnabledDialogProps {
  org: OrgDetail;
  isSubmitting: boolean;
  errorCode: OrgManagerErrorCode | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 停用 / 啟用確認(Figma Draft/ConfirmDialog 88:201)。
 * 停用**連動整棵子樹**、只屬於停用組織的使用者無法登入;啟用只啟用這一節,下層各自處理
 * (`docs/modules/org-manager.md`)— 兩段文案的差別就是這件事,不是同一句換個動詞。
 */
export const ToggleEnabledDialog = ({
  org,
  isSubmitting,
  errorCode,
  onCancel,
  onConfirm,
}: ToggleEnabledDialogProps) => {
  const t = useTranslations("admin.orgManager.toggle");
  const tForm = useTranslations("admin.orgManager.form");
  const tErrors = useTranslations("admin.orgManager.errors");
  const isDisabling = org.enabled;

  return (
    <Dialog
      open
      onClose={onCancel}
      fullWidth
      maxWidth="xs"
      title={isDisabling ? t("disableTitle") : t("enableTitle")}
      actions={
        <>
          <Button variant="text" onClick={onCancel}>
            {tForm("cancel")}
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
          {isDisabling
            ? t("disableBody", { name: org.name })
            : t("enableBody", { name: org.name })}
        </Typography>
        {errorCode !== null && (
          <Alert severity="error">{tErrors(errorCode)}</Alert>
        )}
      </Stack>
    </Dialog>
  );
};
