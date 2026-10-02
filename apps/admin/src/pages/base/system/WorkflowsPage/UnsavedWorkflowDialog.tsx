import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@repo/ui/button";
import { Dialog } from "@repo/ui/dialog";
import { Typography } from "@repo/ui/typography";

export interface UnsavedWorkflowDialogProps {
  onStay: () => void;
  onDiscard: () => void;
  /** 先存草稿再離開;存失敗回 false(留在原地,錯誤顯示在設計器) */
  onSaveAndLeave: () => Promise<boolean>;
}

/**
 * 設計器有未存的變更時要換到別的流程:三選一 —— 留在設計 / 放棄變更 / 先存草稿
 * (同表單管理;不攔的話右欄一換流程,設計器卸載,改動就無聲消失)。
 */
export const UnsavedWorkflowDialog = ({
  onStay,
  onDiscard,
  onSaveAndLeave,
}: UnsavedWorkflowDialogProps) => {
  const t = useTranslations("admin.workflows.unsaved");
  const [isSaving, setIsSaving] = useState(false);

  return (
    <Dialog
      open
      onClose={onStay}
      fullWidth
      maxWidth="xs"
      title={t("title")}
      actions={
        <>
          <Button variant="text" onClick={onStay}>
            {t("stay")}
          </Button>
          <Button variant="text" color="error" onClick={onDiscard}>
            {t("discard")}
          </Button>
          <Button
            disabled={isSaving}
            onClick={() => {
              setIsSaving(true);
              void onSaveAndLeave().finally(() => {
                setIsSaving(false);
              });
            }}
          >
            {t("saveAndLeave")}
          </Button>
        </>
      }
    >
      <Typography variant="body2">{t("body")}</Typography>
    </Dialog>
  );
};
