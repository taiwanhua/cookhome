"use client";

import MuiTableCell from "@mui/material/TableCell";
import MuiTableRow from "@mui/material/TableRow";

export interface DataTableSpacerRowProps {
  height: number;
  colSpan: number;
}

/**
 * 橫跨整列的留白列(`DataTable` 專用子元件):撐出虛擬捲動時可視範圍上下
 * 「沒畫出來的列」的高度,讓捲軸長度與位置維持正確。高度為 0 時不渲染。
 */
export const DataTableSpacerRow = ({
  height,
  colSpan,
}: DataTableSpacerRowProps) =>
  height > 0 ? (
    <MuiTableRow aria-hidden>
      <MuiTableCell colSpan={colSpan} sx={{ height, p: 0, border: 0 }} />
    </MuiTableRow>
  ) : null;
