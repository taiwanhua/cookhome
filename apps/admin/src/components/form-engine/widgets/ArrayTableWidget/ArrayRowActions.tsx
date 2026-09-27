import { memo } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@repo/ui/button";
import { Stack } from "@repo/ui/stack";

export interface ArrayRowActionsProps {
  rowId: string;
  /** 第幾列(1 起算,按鈕的無障礙名稱用) */
  index: number;
  canAdd: boolean;
  /** 穩定的回呼(收 `rowId`),memo 才擋得住重繪 */
  onDuplicate: (rowId: string) => void;
  onRemove: (rowId: string) => void;
}

/** 一列的「複製」「刪除」(複製到 `maxRows` 就停)。 */
export const ArrayRowActions = memo(
  ({ rowId, index, canAdd, onDuplicate, onRemove }: ArrayRowActionsProps) => {
    const t = useTranslations("admin.formEngine.array");

    return (
      <Stack direction="row" spacing={0.5}>
        <Button
          variant="text"
          size="small"
          disabled={!canAdd}
          aria-label={t("duplicateRowAria", { index })}
          onClick={() => {
            onDuplicate(rowId);
          }}
        >
          {t("duplicateRow")}
        </Button>
        <Button
          variant="text"
          size="small"
          color="error"
          aria-label={t("removeRowAria", { index })}
          onClick={() => {
            onRemove(rowId);
          }}
        >
          {t("removeRow")}
        </Button>
      </Stack>
    );
  },
);

ArrayRowActions.displayName = "ArrayRowActions";
