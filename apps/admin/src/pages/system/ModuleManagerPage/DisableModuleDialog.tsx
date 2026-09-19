import { useTranslations } from "use-intl";

import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { Dialog } from "@repo/ui/dialog";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import type {
  ModuleAdminNodeLike,
  ModuleManagerErrorCode,
} from "./module-manager-types";

export interface DisableModuleDialogProps {
  module: ModuleAdminNodeLike;
  isSubmitting: boolean;
  errorCode: ModuleManagerErrorCode | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 停用模組確認(Figma「Overlay / 停用模組確認」211:331 的 Draft/ConfirmDialog 211:332)。
 *
 * **只有停用要確認**:停用連動整棵子樹、所有租戶的側欄同時少一塊,是破壞性的;
 * 啟用只啟用自己這一節(`docs/modules/module-manager.md`「連動與稽核」),
 * 影響範圍小又可逆,直接送出即可,不再多一次點擊。
 */
export const DisableModuleDialog = ({
  module,
  isSubmitting,
  errorCode,
  onCancel,
  onConfirm,
}: DisableModuleDialogProps) => {
  const t = useTranslations("admin.moduleManager.disable");
  const tErrors = useTranslations("admin.moduleManager.errors");

  return (
    <Dialog
      open
      onClose={onCancel}
      fullWidth
      maxWidth="xs"
      title={t("title", { name: module.name })}
      actions={
        <>
          <Button variant="text" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button color="error" disabled={isSubmitting} onClick={onConfirm}>
            {t("confirm")}
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <Typography variant="body2">{t("body")}</Typography>
        {errorCode !== null && (
          <Alert severity="error">{tErrors(errorCode)}</Alert>
        )}
      </Stack>
    </Dialog>
  );
};
