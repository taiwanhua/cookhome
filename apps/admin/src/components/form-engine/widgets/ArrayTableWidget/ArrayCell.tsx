import { createElement } from "react";

import type { ArrayColumnDef, ArrayRowValue } from "@repo/domain/form";

import { cellFieldOf } from "@/lib/form-engine/array-rows";
import type { FormDisplayItemLike } from "@/lib/form-engine/value-text";

import { ReadOnlyField } from "../ReadOnlyField";
import { baseWidgetOf } from "../widget-registry-core";
import type { WidgetContext } from "../widget-types";

export interface ArrayCellProps {
  arrayKey: string;
  column: ArrayColumnDef;
  row: ArrayRowValue;
  context: WidgetContext;
  isDisabled: boolean;
  isReadOnly: boolean;
  isDesign: boolean;
  /** 這一格的錯誤(api 的 `fieldErrors` 以 `rowId` + `columnKey` 定位) */
  errorMessage: string | null;
  display: readonly FormDisplayItemLike[];
  onChange: (columnKey: string, value: unknown) => void;
}

/**
 * 明細列的一格:子欄型別的填寫元件(同表單層欄位的 widget 登錄表),唯讀檢視同一個元件走 `isReadOnly`;
 * 列內公式的子欄一律是唯讀輸入框(顯示後端 / 前端算出的值)。錯誤只標在這一格。
 */
export const ArrayCell = ({
  arrayKey,
  column,
  row,
  context,
  isDisabled,
  isReadOnly,
  isDesign,
  errorMessage,
  display,
  onChange,
}: ArrayCellProps) => {
  const field = cellFieldOf(arrayKey, column);
  const value = row[column.key] ?? null;
  if (column.valueSource.kind === "computed") {
    return (
      <ReadOnlyField
        field={field}
        value={value}
        context={context}
        {...(errorMessage !== null && { helperText: errorMessage })}
      />
    );
  }
  // 登錄表查到的是模組層常數元件(不是 render 內建立的),以 createElement 掛上
  return createElement(baseWidgetOf(column.widget.kind), {
    field,
    value,
    onChange: (next: unknown) => {
      onChange(column.key, next);
    },
    isDisabled,
    isReadOnly,
    isDesign,
    hasError: errorMessage !== null,
    context,
    display,
    ...(errorMessage !== null && { helperText: errorMessage }),
  });
};
