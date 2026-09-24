"use client";

import MuiTableCell from "@mui/material/TableCell";
import MuiTableRow from "@mui/material/TableRow";
import type { Cell, RowData } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo } from "react";

import { mergeSx } from "../theme/sx";
import { DataTableSpacerRow } from "./DataTableSpacerRow";
import { displayValueOf } from "./cell-render-context";
import type { DataTableColumn } from "./data-table-column";
import { type PinnedPlacement, pinnedCellSx } from "./pinned-cell-sx";
import type { DataTableFeatures, DataTableInstance } from "./useDataTable";

/** 單列高度的估計值(px):實際高度以量測為準,估得準只是讓捲軸一開始就接近正確 */
const ESTIMATED_ROW_HEIGHT = { small: 37, medium: 53 } as const;
/** 可視範圍外多畫幾列,快速捲動時不會先看到空白 */
const OVERSCAN = 8;

export interface DataTableBodyRowsProps<Row extends RowData> {
  table: DataTableInstance<Row>;
  columnByKey: ReadonlyMap<string, DataTableColumn<Row>>;
  placementOf: (columnKey: string) => PinnedPlacement | undefined;
  scrollElement: HTMLDivElement | null;
  size: "small" | "medium";
  onRowClick?: (row: Row) => void;
}

/**
 * 表身的資料列(`DataTable` 專用子元件):只渲染可視範圍內的列(`@tanstack/react-virtual`),
 * 上下以留白列撐高,原生表格版面(欄寬、sticky 固定欄)因此不受影響。
 */
export const DataTableBodyRows = <Row extends RowData>({
  table,
  columnByKey,
  placementOf,
  scrollElement,
  size,
  onRowClick,
}: DataTableBodyRowsProps<Row>) => {
  const modelRows = table.getRowModel().rows;
  const displayRows = useMemo(
    () => modelRows.map((row) => row.original),
    [modelRows],
  );
  // useVirtualizer 回傳可變的實例,React Compiler 因此跳過本元件的自動 memo;
  // 本元件不把 virtualizer 的函式往下傳給 memo 過的子元件,略過 memo 不影響正確性
  // eslint-disable-next-line react-hooks/incompatible-library -- 見上兩行
  const virtualizer = useVirtualizer({
    count: modelRows.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => ESTIMATED_ROW_HEIGHT[size],
    getItemKey: (index) => modelRows[index]?.id ?? index,
    overscan: OVERSCAN,
  });
  const items = virtualizer.getVirtualItems();
  const paddingTop = items[0]?.start ?? 0;
  const paddingBottom =
    items.length > 0
      ? virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0)
      : 0;
  // 固定欄 + 捲動區 + 補位欄(吃掉 minWidth 多出來的寬度)
  const colSpan = table.getAllLeafColumns().length + 1;
  const isRowClickable = onRowClick !== undefined;

  const renderCell = (cell: Cell<DataTableFeatures, Row>, index: number) => {
    const column = columnByKey.get(cell.column.id);
    if (column === undefined) {
      return null;
    }
    const row = cell.row.original;
    const value = cell.getValue();
    return (
      <MuiTableCell
        key={cell.id}
        align={column.align}
        sx={mergeSx(
          {
            typography: column.isEmphasized === true ? "subtitle2" : "body2",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          },
          pinnedCellSx(placementOf(column.key), false),
        )}
      >
        {column.render === undefined
          ? displayValueOf(value)
          : column.render({ value, row, rows: displayRows, index, column })}
      </MuiTableCell>
    );
  };

  return (
    <>
      <DataTableSpacerRow height={paddingTop} colSpan={colSpan} />
      {items.map((item) => {
        const row = modelRows[item.index];
        if (row === undefined) {
          return null;
        }
        return (
          <MuiTableRow
            key={row.id}
            ref={virtualizer.measureElement}
            data-index={item.index}
            aria-rowindex={item.index + 2}
            hover={isRowClickable}
            onClick={
              isRowClickable
                ? () => {
                    onRowClick(row.original);
                  }
                : undefined
            }
            sx={{ cursor: isRowClickable ? "pointer" : undefined }}
          >
            {row
              .getStartVisibleCells()
              .map((cell) => renderCell(cell, item.index))}
            {row
              .getCenterVisibleCells()
              .map((cell) => renderCell(cell, item.index))}
            <MuiTableCell aria-hidden sx={{ p: 0 }} />
            {row
              .getEndVisibleCells()
              .map((cell) => renderCell(cell, item.index))}
          </MuiTableRow>
        );
      })}
      <DataTableSpacerRow height={paddingBottom} colSpan={colSpan} />
    </>
  );
};
