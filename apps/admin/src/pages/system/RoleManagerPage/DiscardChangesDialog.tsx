import { useTranslations } from "use-intl";

import { Button } from "@repo/ui/button";
import { Dialog } from "@repo/ui/dialog";
import { Typography } from "@repo/ui/typography";

export interface DiscardChangesDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 放棄未儲存變更(Figma 70:209)。權限矩陣有未儲存的變更時,切頁籤或換角色都先問一次;
 * 關分頁 / 重新整理由 `useUnsavedGuard` 接瀏覽器自己的提示(頁面攔不到那一層)。
 */
export const DiscardChangesDialog = ({
  onCancel,
  onConfirm,
}: DiscardChangesDialogProps) => {
  const t = useTranslations("admin.roleManager.discard");

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
            {t("keepEditing")}
          </Button>
          <Button color="error" onClick={onConfirm}>
            {t("confirm")}
          </Button>
        </>
      }
    >
      <Typography variant="body2">{t("body")}</Typography>
    </Dialog>
  );
};
