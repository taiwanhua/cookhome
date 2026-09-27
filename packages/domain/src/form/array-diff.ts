import { arrayColumnsOf, arrayRowsOf } from "./array";
import { toDecimal } from "./decimal";
import { toInstant } from "./temporal";
import type { ArrayColumnDef, ArrayRowValue, FieldDef } from "./types";

/**
 * 明細列的修訂差異(Spec 6a §5「明細列」:以 `rowId` 對列,列的新增 / 刪除 / 移動 / 某格改值分別標示)。
 * 兩個修訂都存完整快照,差異在讀取時算(admin 修訂差異畫面用;api 測試以它驗快照保留 `rowId`)。
 *
 * - 新增:後一版有、前一版沒有的 `rowId`
 * - 刪除:前一版有、後一版沒有的 `rowId`
 * - 移動:兩版都有的列,在「兩版共有的列」之間的先後順序變了(順序 = 陣列順序持久化)
 * - 改值:兩版都有的列,某些子欄的值不同(比識別:選項比 value、數字比數值、日期比時點)
 *
 * 一列可以同時移動又改值。沒有任何變動的列不列出。
 */
export type ArrayRowChangeKind = "added" | "removed" | "kept";

export interface ArrayRowChange {
  rowId: string;
  kind: ArrayRowChangeKind;
  /** 只有 `kept`:在共有列之間的先後順序變了 */
  isMoved: boolean;
  /** 只有 `kept`:值不同的子欄 key(依子欄定義順序) */
  changedColumns: string[];
  before: ArrayRowValue | null;
  after: ArrayRowValue | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 一格值的識別(與「沒動」的判定同一個精神:比識別不比整個物件)。 */
function cellIdentity(column: ArrayColumnDef, value: unknown): string {
  if (value === undefined || [null, ""].includes(value as string | null)) {
    return "null";
  }
  if (column.type === "number") {
    return toDecimal(value)?.toString() ?? JSON.stringify(value);
  }
  if (column.type === "date" || column.type === "datetime") {
    const instant = toInstant(value);
    return instant === null ? JSON.stringify(value) : String(instant);
  }
  if (isRecord(value)) {
    return JSON.stringify(value.value ?? value.id ?? value);
  }
  return JSON.stringify(value);
}

export function arrayRowChanges(
  field: Pick<FieldDef, "type" | "columns">,
  before: unknown,
  after: unknown,
): ArrayRowChange[] {
  const columns = arrayColumnsOf(field);
  const beforeRows = arrayRowsOf(before);
  const afterRows = arrayRowsOf(after);
  const beforeById = new Map(beforeRows.map((row) => [row.rowId, row]));
  const afterIds = new Set(afterRows.map((row) => row.rowId));
  const commonBefore = beforeRows
    .map((row) => row.rowId)
    .filter((id) => afterIds.has(id));
  const commonAfter = afterRows
    .map((row) => row.rowId)
    .filter((id) => beforeById.has(id));
  const changes: ArrayRowChange[] = [];
  for (const row of afterRows) {
    const previous = beforeById.get(row.rowId);
    if (previous === undefined) {
      changes.push({
        rowId: row.rowId,
        kind: "added",
        isMoved: false,
        changedColumns: [],
        before: null,
        after: row,
      });
      continue;
    }
    const isMoved =
      commonBefore.indexOf(row.rowId) !== commonAfter.indexOf(row.rowId);
    const changedColumns = columns
      .filter(
        (column) =>
          cellIdentity(column, previous[column.key]) !==
          cellIdentity(column, row[column.key]),
      )
      .map((column) => column.key);
    if (isMoved || changedColumns.length > 0) {
      changes.push({
        rowId: row.rowId,
        kind: "kept",
        isMoved,
        changedColumns,
        before: previous,
        after: row,
      });
    }
  }
  for (const row of beforeRows) {
    if (!afterIds.has(row.rowId)) {
      changes.push({
        rowId: row.rowId,
        kind: "removed",
        isMoved: false,
        changedColumns: [],
        before: row,
        after: null,
      });
    }
  }
  return changes;
}
