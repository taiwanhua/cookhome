import { useTranslations } from "use-intl";

import {
  type ArrayRowValue,
  arrayColumnsOf,
  arrayRowLimitsOf,
  arrayRowsOf,
} from "@repo/domain/form";
import { Button } from "@repo/ui/button";
import { useBreakpointDown } from "@repo/ui/media-query";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import {
  duplicateRowIn,
  emptyRowOf,
  removeRowIn,
  setCellIn,
} from "@/lib/form-engine/array-rows";

import type { WidgetProps } from "../widget-types";
import { ArrayRowCards } from "./ArrayRowCards";
import { ArrayRowsTable } from "./ArrayRowsTable";
import type { ArrayRowsViewProps } from "./array-rows-view";

/**
 * 明細列(`array` → `table`,Spec 6a §5「明細列」):一個欄位裝多列同結構的子欄位。
 *
 * - 桌機是表格(每列一行、每格是子欄型別的填寫元件,列尾「複製」「刪除」);手機寬(< `sm`)每列一張卡片
 *   (子欄直排)
 * - 表尾「+ 新增一列」,到 `maxRows` 停(複製也受它限制);不做拖拉排序
 * - 錯誤:每格獨立(api 的 `fieldErrors` 以 `rowId` + `columnKey` 定位),列數不足 / 超過在表尾
 * - 唯讀檢視同一個元件走 `isReadOnly`(每格走該型別 widget 的唯讀分支,沒有新增 / 刪除 / 複製)
 * - 設計模式只畫表格外觀的占位(表頭 = 子欄標題)
 *
 * 列內公式與彙總由 `FormRenderer` 即時算(domain 同一套),這裡拿到的列已經帶著算好的值。
 */
export const ArrayTableWidget = ({
  field,
  value,
  onChange,
  isDisabled,
  isReadOnly = false,
  isDesign,
  helperText,
  errors = [],
  context,
  columnDisplay,
}: WidgetProps) => {
  const t = useTranslations("admin.formEngine.array");
  const isMobile = useBreakpointDown("sm");
  const columns = arrayColumnsOf(field);
  const rows = arrayRowsOf(value);
  const { max } = arrayRowLimitsOf(field);
  const canEdit = !isReadOnly && !isDisabled && !isDesign;
  const isFull = rows.length >= max;
  const footerErrors = errors.filter((error) => error.rowId === undefined);

  const commit = (next: ArrayRowValue[]) => {
    onChange(next);
  };

  const view: ArrayRowsViewProps = {
    arrayKey: field.key,
    label: field.label,
    columns,
    rows,
    context,
    canEdit,
    canAdd: !isFull,
    isDisabled,
    isReadOnly,
    isDesign,
    cellError: (rowId, columnKey) =>
      errors.find(
        (error) => error.rowId === rowId && error.columnKey === columnKey,
      )?.message ?? null,
    displayOf: (columnKey) => columnDisplay?.(columnKey) ?? [],
    onCellChange: (rowId, columnKey, next) => {
      commit(setCellIn(rows, rowId, columnKey, next));
    },
    onDuplicate: (rowId) => {
      commit(duplicateRowIn(rows, rowId));
    },
    onRemove: (rowId) => {
      commit(removeRowIn(rows, rowId));
    },
  };

  return (
    <Stack spacing={1} component="section" aria-label={field.label}>
      <Typography variant="subtitle2" component="h3">
        {field.label}
        {field.rules?.required === true && " *"}
      </Typography>
      {isMobile ? <ArrayRowCards {...view} /> : <ArrayRowsTable {...view} />}
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
      >
        {(canEdit || isDesign) && (
          <Button
            variant="text"
            size="small"
            disabled={!canEdit || isFull}
            onClick={() => {
              commit([...rows, emptyRowOf(columns)]);
            }}
          >
            {t("addRow")}
          </Button>
        )}
        {canEdit && isFull && (
          <Typography variant="caption" color="text.secondary">
            {t("maxReached", { max })}
          </Typography>
        )}
      </Stack>
      {footerErrors.map((error) => (
        <Typography
          key={`${error.code}-${error.message}`}
          variant="caption"
          color="error"
          role="alert"
        >
          {error.message}
        </Typography>
      ))}
      {helperText !== undefined && (
        <Typography variant="caption" color="text.secondary">
          {helperText}
        </Typography>
      )}
    </Stack>
  );
};
