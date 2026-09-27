import { useTranslations } from "use-intl";

import { Button } from "@repo/ui/button";
import { Stack } from "@repo/ui/stack";

export interface ArrayRowActionsProps {
  /** 第幾列(1 起算,按鈕的無障礙名稱用) */
  index: number;
  canAdd: boolean;
  onDuplicate: () => void;
  onRemove: () => void;
}

/** 一列的「複製」「刪除」(複製到 `maxRows` 就停)。 */
export const ArrayRowActions = ({
  index,
  canAdd,
  onDuplicate,
  onRemove,
}: ArrayRowActionsProps) => {
  const t = useTranslations("admin.formEngine.array");

  return (
    <Stack direction="row" spacing={0.5}>
      <Button
        variant="text"
        size="small"
        disabled={!canAdd}
        aria-label={t("duplicateRowAria", { index })}
        onClick={onDuplicate}
      >
        {t("duplicateRow")}
      </Button>
      <Button
        variant="text"
        size="small"
        color="error"
        aria-label={t("removeRowAria", { index })}
        onClick={onRemove}
      >
        {t("removeRow")}
      </Button>
    </Stack>
  );
};
