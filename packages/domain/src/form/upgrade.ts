import { arrayColumnsOf, arrayRowsOf } from "./array";
import type {
  ArrayColumnDef,
  ArrayRowValue,
  FieldDef,
  StoredValues,
  SummaryMap,
} from "./types";
import { isEmptyValue } from "./values";

/** 搬值要的定義:只看欄位與摘要槽。 */
export interface UpgradeDefinition {
  fields: readonly FieldDef[];
  summaryMap?: SummaryMap | null;
}

/** 補值不列入的型別:明細列逐列才有意義、上傳要有檔案、引用要重驗來源,都不適合一次填給所有筆。 */
const UNFILLABLE_TYPES: ReadonlySet<FieldDef["type"]> = new Set([
  "array",
  "upload",
  "reference",
]);

/** 目標欄位能不能從來源欄位接值:目標是使用者填的欄位、來源有同 key 同型別的欄位。 */
function carriesOver(
  target: Pick<FieldDef, "type" | "valueSource">,
  source: Pick<FieldDef, "type"> | undefined,
): boolean {
  return target.valueSource.kind === "input" && source?.type === target.type;
}

/** 明細列逐子欄同規則:只留目標仍有、同型別、使用者填的子欄;`rowId` 保留(同一列)。 */
function carriedRowsOf(
  target: FieldDef,
  source: FieldDef,
  value: unknown,
): ArrayRowValue[] {
  const sourceColumns = arrayColumnsOf(source);
  const kept = arrayColumnsOf(target).filter((column: ArrayColumnDef) =>
    carriesOver(
      column,
      sourceColumns.find((candidate) => candidate.key === column.key),
    ),
  );
  return arrayRowsOf(value).map((row) => {
    const carried: ArrayRowValue = { rowId: row.rowId };
    for (const column of kept) {
      carried[column.key] = row[column.key] ?? null;
    }
    return carried;
  });
}

/**
 * 一筆提交的值從來源版本搬到目標版本(舊版資料升級、複製為新單共用同一段):
 *
 * - 目標版的**使用者填**欄位,來源版有同 key、同型別的欄位 → 保留值;明細列逐子欄同規則(`rowId` 保留)
 * - 目標版沒有的欄位、型別變了的欄位、計算 / 固定值欄位 → 不搬(計算欄位由呼叫端重算)
 * - `fills` 只填**搬完後沒有值**的欄位(已有值不覆蓋);不在目標版、不是使用者填的鍵忽略
 *
 * 不驗證規則、不碰權限:權限守門(誰看得到、誰改得動)由呼叫端先篩。
 */
export function upgradeValues(
  from: UpgradeDefinition,
  to: UpgradeDefinition,
  values: StoredValues,
  fills: StoredValues = {},
): StoredValues {
  const upgraded: StoredValues = {};
  for (const field of to.fields) {
    const source = from.fields.find((candidate) => candidate.key === field.key);
    const value = values[field.key];
    if (
      source !== undefined &&
      carriesOver(field, source) &&
      value !== null &&
      value !== undefined
    ) {
      upgraded[field.key] =
        field.type === "array" ? carriedRowsOf(field, source, value) : value;
    }
    const fill = fills[field.key];
    if (
      field.valueSource.kind === "input" &&
      isEmptyValue(upgraded[field.key]) &&
      !isEmptyValue(fill)
    ) {
      upgraded[field.key] = fill;
    }
  }
  return upgraded;
}

/** 對到摘要槽的欄位 key。 */
function summaryKeysOf(summaryMap: SummaryMap | null | undefined): Set<string> {
  return new Set(
    [summaryMap?.title, summaryMap?.date, summaryMap?.amount].filter(
      (key): key is string => typeof key === "string" && key !== "",
    ),
  );
}

/**
 * 升級的補值欄位(目標版的欄位,依目標版順序):**使用者填**、不是明細列 / 上傳 / 引用,且符合任一條:
 *
 * - 必填
 * - 對到摘要槽
 * - 目標版新增的:任一個來源版沒有同 key 同型別的欄位(那一版的資料搬過來一定是空的)
 */
export function upgradeFillTargets(
  to: UpgradeDefinition,
  fromDefs: readonly UpgradeDefinition[],
): FieldDef[] {
  const summaryKeys = summaryKeysOf(to.summaryMap);
  return to.fields.filter((field) => {
    if (
      field.valueSource.kind !== "input" ||
      UNFILLABLE_TYPES.has(field.type)
    ) {
      return false;
    }
    const isAdded = fromDefs.some(
      (from) =>
        !carriesOver(
          field,
          from.fields.find((candidate) => candidate.key === field.key),
        ),
    );
    return (
      field.rules?.required === true || summaryKeys.has(field.key) || isAdded
    );
  });
}
