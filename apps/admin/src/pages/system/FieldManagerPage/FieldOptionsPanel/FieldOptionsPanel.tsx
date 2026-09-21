import { useTranslations } from "use-intl";

import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import type {
  FieldCategoryLike,
  FieldOptionLike,
} from "../field-manager-types";
import { FieldOptionsTable } from "./FieldOptionsTable";

export interface FieldOptionsPanelProps {
  category: FieldCategoryLike | null;
  fields: readonly FieldOptionLike[];
  isLoading: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canToggleEnabled: boolean;
  pendingFieldId: string | null;
  onCreate: () => void;
  onEdit: (field: FieldOptionLike) => void;
  onToggleEnabled: (field: FieldOptionLike, enabled: boolean) => void;
}

/**
 * 右欄選項區(Figma Options 90:227):標題「<類別名> — 選項」+「新增自訂選項」+ 表格。
 * 新增鈕依 `system.field-manager.create` 出現與否(ADR-0011:沒有權限的動作不顯示)。
 */
export const FieldOptionsPanel = ({
  category,
  fields,
  isLoading,
  canCreate,
  canEdit,
  canToggleEnabled,
  pendingFieldId,
  onCreate,
  onEdit,
  onToggleEnabled,
}: FieldOptionsPanelProps) => {
  const t = useTranslations("admin.fieldManager.options");

  return (
    <Card
      component="section"
      aria-label={t("region")}
      // 欄型 flex:標題列固定、選項表吃掉剩下的高度並自己捲(#299),
      // 面板不再整塊捲,橫向捲軸才落在面板底部而不是最後一列下方
      sx={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        p: 3,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", pb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ flex: 1, minWidth: 0 }}>
          {category === null
            ? t("noCategory")
            : t("title", { category: category.name })}
        </Typography>
        {canCreate && category !== null && (
          <Button size="small" onClick={onCreate}>
            {t("create")}
          </Button>
        )}
      </Stack>

      {category === null ? (
        <Typography variant="body2" color="text.secondary">
          {t("noCategoryHint")}
        </Typography>
      ) : (
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <FieldOptionsTable
            fields={fields}
            isLoading={isLoading}
            canEdit={canEdit}
            canToggleEnabled={canToggleEnabled}
            pendingFieldId={pendingFieldId}
            onToggleEnabled={onToggleEnabled}
            onEdit={onEdit}
          />
        </Box>
      )}
    </Card>
  );
};
