import type { TableCellProps as MuiTableCellProps } from "@mui/material/TableCell";
import type { ReactNode } from "react";

/**
 * 欄位的取值方式:列物件上的欄位名,或自訂函式(組合欄、衍生值)。
 * `DataTable` 的排序比的就是這裡取出的值。
 */
export type ColumnAccessor<Row> =
  (keyof Row & string) | ((row: Row) => unknown);

/**
 * 欄位宣告中「渲染時看得到」的部分(REACT-13):`Table` 與 `DataTable` 共用。
 * `DataTable` 的每個欄位都用得到;`Table` 只認 key / header / accessor / align / width / isEmphasized,
 * 其餘欄位在 `Table` 上沒有作用。
 */
export interface CellRenderColumn<Row> {
  /** 欄位識別,同時作為 React key 與排序 / 欄寬狀態的 key */
  key: string;
  /** 表頭內容 */
  header: ReactNode;
  /** 取值方式;沒給時 `ctx.value` 是 `undefined` */
  accessor?: ColumnAccessor<Row>;
  align?: NonNullable<MuiTableCellProps["align"]>;
  width?: number | string;
  /** 欄寬下限(拖拉縮不過它) */
  minWidth?: number;
  /** 固定在左或右;捲動時不離開視窗 */
  pinned?: "left" | "right";
  /** 表頭可點擊排序 */
  isSortable?: boolean;
  /** Figma Emphasis=Strong:主要識別欄(如姓名)用較重字重 */
  isEmphasized?: boolean;
}

/**
 * 每一格的渲染參數(REACT-13)。`rows` / `index` 是**顯示順序**(排序後),所以
 * `rows[index] === row` 永遠成立;做「合計列」「與上一列比較」「奇偶列」時用它們。
 * `@repo/ui` 語言無關(I18N-01):這裡不帶翻譯函式,文字由呼叫端在閉包裡自己取。
 */
export interface CellRenderContext<Row> {
  /** 由 `column.accessor` 取出的值 */
  value: unknown;
  row: Row;
  rows: readonly Row[];
  index: number;
  column: CellRenderColumn<Row>;
}

/** 依欄位的 `accessor` 取出該列的值;沒給 `accessor` 時為 `undefined`。 */
export const cellValueOf = <Row>(
  column: Pick<CellRenderColumn<Row>, "accessor">,
  row: Row,
): unknown => {
  const { accessor } = column;
  if (accessor === undefined) {
    return undefined;
  }
  return typeof accessor === "function" ? accessor(row) : row[accessor];
};

/**
 * 沒給 `render` 時的預設顯示:字串 / 數字原樣,布林轉字串,日期轉 ISO;
 * 空值與物件不顯示(物件該怎麼畫只有呼叫端知道,給 `render`)。
 */
export const displayValueOf = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return null;
};
