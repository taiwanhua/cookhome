import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@repo/ui/button";
import { Dialog } from "@repo/ui/dialog";
import { Typography } from "@repo/ui/typography";

export interface UnsavedDesignDialogProps {
  /** 繼續設計(不離開) */
  onStay: () => void;
  /** 放棄未存的變更並離開 */
  onDiscard: () => void;
  /** 先存草稿再離開;存失敗回 false(留在原地,錯誤顯示在設計器) */
  onSaveAndLeave: () => Promise<boolean>;
}

/**
 * 設計器有未存的變更時要換到別張表單:三選一 —— 留在設計 / 放棄變更 / 先存草稿。
 * 不攔的話右欄一換表單,設計器卸載,改動就無聲消失。
 */
export const UnsavedDesignDialog = ({
  onStay,
  onDiscard,
  onSaveAndLeave,
}: UnsavedDesignDialogProps) => {
  const t = useTranslations("admin.forms.unsaved");
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
