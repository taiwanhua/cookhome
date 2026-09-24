"use client";

import MuiTable from "@mui/material/Table";
import MuiTableBody from "@mui/material/TableBody";
import MuiTableCell from "@mui/material/TableCell";
import MuiTableContainer from "@mui/material/TableContainer";
import MuiTableHead from "@mui/material/TableHead";
import MuiTableRow from "@mui/material/TableRow";
import type { SxProps, Theme } from "@mui/material/styles";
import type { RowData } from "@tanstack/react-table";
import { type ReactNode, useMemo, useState } from "react";

import { CircularProgress } from "../CircularProgress/CircularProgress";
import { TableStatusRow } from "../Table/TableStatusRow";
import { mergeSx } from "../theme/sx";
import { DataTableBodyRows } from "./DataTableBodyRows";
import { DataTableHeaderCell } from "./DataTableHeaderCell";
import type { CellRenderColumn } from "./cell-render-context";
import type {
  DataTableColumn,
  DataTableColumnWidths,
  DataTableSort,
} from "./data-table-column";
import { pinnedPlacementOf } from "./pinned-cell-sx";
import { useDataTable } from "./useDataTable";

export type {
  CellRenderColumn,
  CellRenderContext,
  ColumnAccessor,
} from "./cell-render-context";
export type {
  DataTableColumn,
  DataTableColumnWidths,
  DataTableSort,
} from "./data-table-column";

export interface DataTableProps<Row extends RowData> {
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  /** 每列的唯一鍵;不要用陣列索引 */
  getRowKey: (row: Row) => string;
  /** 載入中:表身改顯示載入指示,不渲染任何列 */
  isLoading?: boolean;
  /** 沒有資料時的文案(預設「目前沒有資料」);載入中時不顯示 */
  emptyMessage?: ReactNode;
  /** 整列可點(如開啟明細);未給則列不可互動 */
  onRowClick?: (row: Row) => void;
  /** 目前的排序(受控);給了就由呼叫端管,`null` = 不排序 */
  sort?: DataTableSort | null;
  /** 不受控時的初始排序 */
  defaultSort?: DataTableSort | null;
  /** 點表頭排序鈕:依「升冪 → 降冪 → 不排序」輪替 */
  onSortChange?: (sort: DataTableSort | null) => void;
  /** 資料已由 api 排好序:只切換表頭狀態、不在前端重排 */
  isManualSorting?: boolean;
  /** 欄寬(受控);給了就由呼叫端管,沒列到的欄用欄位宣告的 `width` */
  columnWidths?: DataTableColumnWidths;
  /** 拖拉或鍵盤調整欄寬時回報整份欄寬 */
  onColumnWidthsChange?: (widths: DataTableColumnWidths) => void;
  /** 欄寬把手的無障礙名稱;預設「調整「<表頭>」欄寬」(表頭不是字串時用 key) */
  resizeLabelOf?: (column: CellRenderColumn<Row>) => string;
  /**
   * 表格最小寬度(px):容器比它窄時橫向捲動;欄寬總和比它大時以欄寬總和為準。
   * 多出來的寬度由固定在右側的欄之前的補位欄吃掉,欄寬不會被拉伸。
   */
  minWidth?: number;
  size?: "small" | "medium";
  /**
   * 疊加到捲動容器(`TableContainer`)上的樣式;預設撐滿父層高度。
   * 虛擬捲動需要確定的高度:父層高度不確定時用它給 `height` / `maxHeight`。
   */
  containerSx?: SxProps<Theme>;
  "aria-label"?: string;
}

const defaultResizeLabel = <Row,>(column: CellRenderColumn<Row>): string =>
  `調整「${typeof column.header === "string" ? column.header : column.key}」欄寬`;

/**
 * 大量資料的表格(TanStack Table + Virtual):列虛擬捲動、欄寬拖拉、左右固定欄、單欄排序。
 * 欄位宣告與渲染簽章見 REACT-13;少量資料的治理頁小表用 `@repo/ui/table` 的 `Table`。
 */
export const DataTable = <Row extends RowData>({
  columns,
  rows,
  getRowKey,
  isLoading = false,
  emptyMessage = "目前沒有資料",
  onRowClick,
  sort,
  defaultSort,
  onSortChange,
  isManualSorting,
  columnWidths,
  onColumnWidthsChange,
  resizeLabelOf = defaultResizeLabel,
  minWidth = 0,
  size = "medium",
  containerSx,
  "aria-label": ariaLabel,
}: DataTableProps<Row>) => {
  // 捲動容器放 state 而不是 ref:ref 在子層的 layout effect 之後才掛上,
  // 虛擬捲動第一次量測時會拿到 null、之後也沒有重新渲染的契機
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );
  const table = useDataTable({
    columns,
    rows,
    getRowKey,
    sort,
    defaultSort,
    onSortChange,
    isManualSorting,
    columnWidths,
    onColumnWidthsChange,
  });
  const columnByKey = useMemo(
    () => new Map(columns.map((column) => [column.key, column])),
    [columns],
  );

  const startHeaders = table.getStartLeafHeaders();
  const centerHeaders = table.getCenterLeafHeaders();
  const endHeaders = table.getEndLeafHeaders();
  const startIds = startHeaders.map((header) => header.column.id);
  const endIds = endHeaders.map((header) => header.column.id);
  const placementOf = (columnKey: string) => {
    const column = table.getColumn(columnKey);
    return column === undefined
      ? undefined
      : pinnedPlacementOf(column, startIds, endIds);
  };
  const handleKeyboardResize = (columnKey: string, width: number) => {
    table.setColumnSizing((previous) => ({ ...previous, [columnKey]: width }));
  };

  const colSpan = columns.length + 1;
  const isEmpty = !isLoading && rows.length === 0;

  const renderHeader = (header: (typeof centerHeaders)[number]) => {
    const column = columnByKey.get(header.column.id);
    return column === undefined ? null : (
      <DataTableHeaderCell
        key={header.id}
        header={header}
        column={column}
        placement={placementOf(column.key)}
        resizeLabel={resizeLabelOf(column)}
        onKeyboardResize={handleKeyboardResize}
      />
    );
  };

  return (
    <MuiTableContainer
      ref={setScrollElement}
      sx={mergeSx({ height: "100%", minHeight: 0 }, containerSx)}
    >
      <MuiTable
        stickyHeader
        size={size}
        aria-label={ariaLabel}
        aria-rowcount={rows.length + 1}
        sx={{
          tableLayout: "fixed",
          width: "100%",
          minWidth: Math.max(table.getTotalSize(), minWidth),
        }}
      >
        <MuiTableHead>
          <MuiTableRow aria-rowindex={1}>
            {startHeaders.map((header) => renderHeader(header))}
            {centerHeaders.map((header) => renderHeader(header))}
            {/* 補位欄:沒有指定寬度,吃掉 minWidth / 容器多出來的寬度,右固定欄因此貼齊右緣 */}
            <MuiTableCell aria-hidden sx={{ p: 0 }} />
            {endHeaders.map((header) => renderHeader(header))}
          </MuiTableRow>
        </MuiTableHead>
        <MuiTableBody>
          {isLoading && (
            <TableStatusRow colSpan={colSpan}>
              <CircularProgress size={24} aria-label="載入中" />
            </TableStatusRow>
          )}
          {isEmpty && (
            <TableStatusRow colSpan={colSpan}>{emptyMessage}</TableStatusRow>
          )}
          {!isLoading && (
            <DataTableBodyRows
              table={table}
              columnByKey={columnByKey}
              placementOf={placementOf}
              scrollElement={scrollElement}
              size={size}
              onRowClick={onRowClick}
            />
          )}
        </MuiTableBody>
      </MuiTable>
    </MuiTableContainer>
  );
};
