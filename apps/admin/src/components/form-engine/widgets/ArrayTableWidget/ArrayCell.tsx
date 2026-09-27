import { createElement, memo } from "react";

import type { ArrayColumnDef } from "@repo/domain/form";
import { Box } from "@repo/ui/box";

import { cellFieldOf } from "@/lib/form-engine/array-rows";
import type { FormDisplayItemLike } from "@/lib/form-engine/value-text";

import { ReadOnlyField } from "../ReadOnlyField";
import { baseWidgetOf } from "../widget-registry-core";
import type { WidgetContext } from "../widget-types";

export interface ArrayCellProps {
  arrayKey: string;
  column: ArrayColumnDef;
  rowId: string;
  /** 這一格的值(傳值不傳整列:別的格改了,這一格不必重繪) */
  value: unknown;
  context: WidgetContext;
  isDisabled: boolean;
  isReadOnly: boolean;
  isDesign: boolean;
  /** 表格裡表頭已經寫了子欄標題:格子的標題只留給輔助技術(視覺隱藏),卡片裡照常顯示 */
  isLabelHidden: boolean;
  /** 這一格的錯誤(api 的 `fieldErrors` 以 `rowId` + `columnKey` 定位) */
  errorMessage: string | null;
  display: readonly FormDisplayItemLike[];
  /** 穩定的回呼(`ArrayTableWidget` 以 ref 取最新的列),memo 才擋得住重繪 */
  onCellChange: (rowId: string, columnKey: string, value: unknown) => void;
}

/**
 * 視覺隱藏(仍是無障礙名稱)的格子標題,並收掉有框輸入框為標題留的缺口。
 * 選取的是 widget 內部的標題元素;格子的元件都是 `@repo/ui` 的輸入框 / 下拉 / 勾選框。
 */
const HIDDEN_LABEL_SX = {
  "& .MuiInputLabel-root, & .MuiFormControlLabel-label": {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
  },
  "& .MuiOutlinedInput-notchedOutline legend": { maxWidth: 0 },
} as const;

/**
 * 明細列的一格:子欄型別的填寫元件(同表單層欄位的 widget 登錄表),唯讀檢視同一個元件走 `isReadOnly`;
 * 列內公式的子欄一律是唯讀輸入框(顯示後端 / 前端算出的值)。錯誤只標在這一格。
 * 以 `memo` 包起來:打一個字只重繪那一格(與依賴它的計算格),不是整張表。
 */
export const ArrayCell = memo(
  ({
    arrayKey,
    column,
    rowId,
    value,
    context,
    isDisabled,
    isReadOnly,
    isDesign,
    isLabelHidden,
    errorMessage,
    display,
    onCellChange,
  }: ArrayCellProps) => {
    const field = cellFieldOf(arrayKey, column);
    const cell =
      column.valueSource.kind === "computed" ? (
        <ReadOnlyField
          field={field}
          value={value ?? null}
          context={context}
          {...(errorMessage !== null && { helperText: errorMessage })}
        />
      ) : (
        // 登錄表查到的是模組層常數元件(不是 render 內建立的),以 createElement 掛上
        createElement(baseWidgetOf(column.widget.kind), {
          field,
          value: value ?? null,
          onChange: (next: unknown) => {
            onCellChange(rowId, column.key, next);
          },
          isDisabled,
          isReadOnly,
          isDesign,
          hasError: errorMessage !== null,
          context,
          display,
          ...(errorMessage !== null && { helperText: errorMessage }),
        })
      );
    return isLabelHidden ? <Box sx={HIDDEN_LABEL_SX}>{cell}</Box> : cell;
  },
);

ArrayCell.displayName = "ArrayCell";
