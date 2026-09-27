import { useTranslations } from "use-intl";

import { Button } from "@repo/ui/button";
import { Dialog } from "@repo/ui/dialog";
import { Typography } from "@repo/ui/typography";

export interface UnbindWorkflowDialogProps {
  workflowName: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 解除流程綁定的警告:之後新送出的單不走流程,但**進過審核的單再送出會被擋**
 * (「此表單的審核流程已移除,請聯絡管理員」;要讓它免審得另定明確動作,6b 不做)。
 */
export const UnbindWorkflowDialog = ({
  workflowName,
  isSubmitting,
  onCancel,
  onConfirm,
}: UnbindWorkflowDialogProps) => {
  const t = useTranslations("admin.forms.binding.unbindDialog");
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
            {t("cancel")}
          </Button>
          <Button color="error" disabled={isSubmitting} onClick={onConfirm}>
            {t("confirm")}
          </Button>
        </>
      }
    >
      <Typography variant="body2">
        {t("body", { workflow: workflowName })}
      </Typography>
    </Dialog>
  );
};
