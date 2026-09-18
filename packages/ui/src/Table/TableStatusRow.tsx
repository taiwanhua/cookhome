"use client";

import MuiTableCell from "@mui/material/TableCell";
import MuiTableRow from "@mui/material/TableRow";
import type { ReactNode } from "react";

export interface TableStatusRowProps {
  /** 橫跨的欄數(= 表頭欄位數),讓狀態訊息置中於整張表 */
  colSpan: number;
  children: ReactNode;
}

/**
 * 表身的整列狀態列:載入中與空狀態共用(`Table` 專用子元件)。
 * 不畫框線,避免只有一列時出現懸空的分隔線。
 */
export const TableStatusRow = ({ colSpan, children }: TableStatusRowProps) => (
  <MuiTableRow>
    <MuiTableCell
      colSpan={colSpan}
      align="center"
      sx={{ border: 0, py: 6, color: "text.secondary", typography: "body2" }}
    >
      {children}
    </MuiTableCell>
  </MuiTableRow>
);
