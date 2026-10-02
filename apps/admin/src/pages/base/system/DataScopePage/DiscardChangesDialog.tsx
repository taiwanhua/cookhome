import { useTranslations } from "use-intl";

import { Button } from "@repo/ui/button";
import { Dialog } from "@repo/ui/dialog";
import { Typography } from "@repo/ui/typography";

export interface DiscardChangesDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 未儲存就要切到別的資料目標時的確認(規則編輯器是整份覆蓋,草稿沒送出就不存在)。
 * 與角色矩陣的「未儲存離開」同一個語意,但這一頁的「離開」是**換左邊的資料目標**。
 */
export const DiscardChangesDialog = ({
  onCancel,
  onConfirm,
}: DiscardChangesDialogProps) => {
  const t = useTranslations("admin.dataScope.discardDialog");

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
          <Button onClick={onConfirm}>{t("confirm")}</Button>
        </>
      }
    >
      <Typography variant="body2">{t("body")}</Typography>
    </Dialog>
  );
};
