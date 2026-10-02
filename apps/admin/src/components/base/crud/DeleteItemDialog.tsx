import { useTranslations } from "use-intl";

import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { Dialog } from "@repo/ui/dialog";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import type { DemoErrorCode } from "./demo-error";

export interface DeleteItemDialogProps {
  i18nNamespace: string;
  itemName: string;
  isSubmitting: boolean;
  errorCode: DemoErrorCode | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 刪除確認(Figma Overlay 177:2314,用 `Draft/ConfirmDialog` 57:712)。
 * 列表與詳情共用同一個彈窗。
 *
 * 破壞性操作:確認鈕是 error 色,文案講清楚後果與不可復原。刪除在 api 是軟刪除,
 * 但對操作者而言就是拿不回來了,所以不在文案上玩「還原得回來」的字眼。
 */
export const DeleteItemDialog = ({
  i18nNamespace,
  itemName,
  isSubmitting,
  errorCode,
  onCancel,
  onConfirm,
}: DeleteItemDialogProps) => {
  const t = useTranslations(`${i18nNamespace}.delete`);
  const tErrors = useTranslations(`${i18nNamespace}.errors`);
  const tForm = useTranslations(`${i18nNamespace}.form`);

  return (
    <Dialog
      open
      onClose={onCancel}
      fullWidth
      maxWidth="xs"
      title={t("title")}
      actions={
        <>
          <Button variant="text" onClick={onCancel}>
            {tForm("cancel")}
          </Button>
          <Button color="error" disabled={isSubmitting} onClick={onConfirm}>
            {t("confirm")}
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <Typography variant="body2">{t("body", { name: itemName })}</Typography>
        {errorCode !== null && (
          <Alert severity="error">{tErrors(errorCode)}</Alert>
        )}
      </Stack>
    </Dialog>
  );
};
