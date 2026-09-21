import { useTranslations } from "use-intl";

import { Alert } from "@repo/ui/alert";
import { Button } from "@repo/ui/button";
import { Dialog } from "@repo/ui/dialog";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import { SAMPLE_ONE_I18N } from "./demo-sample-one-config";
import type { SampleOneErrorCode } from "./demo-sample-one-error";

export interface DeleteItemDialogProps {
  itemName: string;
  isSubmitting: boolean;
  errorCode: SampleOneErrorCode | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 刪除確認(Figma Overlay 177:2314,用 `Draft/ConfirmDialog` 57:712)。
 * 破壞性操作:確認鈕是 error 色,文案講清楚後果與不可復原。
 * 刪除是軟刪除,但對操作者而言就是拿不回來了,所以不在文案上玩「還原得回來」的字眼。
 */
export const DeleteItemDialog = ({
  itemName,
  isSubmitting,
  errorCode,
  onCancel,
  onConfirm,
}: DeleteItemDialogProps) => {
  const t = useTranslations(`${SAMPLE_ONE_I18N}.delete`);
  const tErrors = useTranslations(`${SAMPLE_ONE_I18N}.errors`);
  const tForm = useTranslations(`${SAMPLE_ONE_I18N}.form`);

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
