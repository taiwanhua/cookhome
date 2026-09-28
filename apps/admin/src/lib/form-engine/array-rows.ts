import {
  type ArrayColumnDef,
  type ArrayRowValue,
  type FieldDef,
  columnPathOf,
} from "@repo/domain/form";

/**
 * 明細列(`array`)填寫時的列操作(純函式;`ArrayTableWidget` 與測試共用,Spec 6a §5「明細列」):
 * 每列 `{ rowId, <子欄 key>: 值 }`,`rowId` 在建列時以 `crypto.randomUUID()` 產生、之後不變;
 * 「複製列」產生新的 `rowId`;順序 = 陣列順序(不做拖拉排序)。
 */

export const newRowId = (): string => globalThis.crypto.randomUUID();

/** 新的一列:每個子欄都是空值。 */
export const emptyRowOf = (
  columns: readonly ArrayColumnDef[],
): ArrayRowValue => {
  const row: ArrayRowValue = { rowId: newRowId() };
  for (const column of columns) {
    row[column.key] = null;
  }
  return row;
};

/** 複製一列,插在它的下一列(新的 `rowId`,其餘照抄)。 */
export const duplicateRowIn = (
  rows: readonly ArrayRowValue[],
  rowId: string,
): ArrayRowValue[] => {
  const index = rows.findIndex((row) => row.rowId === rowId);
  if (index === -1) {
    return [...rows];
  }
  return [
    ...rows.slice(0, index + 1),
    { ...rows[index], rowId: newRowId() },
    ...rows.slice(index + 1),
  ];
};

export const removeRowIn = (
  rows: readonly ArrayRowValue[],
  rowId: string,
): ArrayRowValue[] => rows.filter((row) => row.rowId !== rowId);

export const setCellIn = (
  rows: readonly ArrayRowValue[],
  rowId: string,
  columnKey: string,
  value: unknown,
): ArrayRowValue[] =>
  rows.map((row) =>
    row.rowId === rowId ? { ...row, [columnKey]: value } : row,
  );

/**
 * 一格的填寫元件吃的欄位定義:子欄本身,只把 key 換成 `<明細 key>.<子欄 key>` ——
 * 類別選項的查詢(`formFieldOptions`)與顯示名(`displayValues`)都以這個路徑指到子欄。
 */
export const cellFieldOf = (
  arrayKey: string,
  column: ArrayColumnDef,
): FieldDef => ({ ...column, key: columnPathOf(arrayKey, column.key) });
