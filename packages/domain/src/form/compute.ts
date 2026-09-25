import { FormDecimal, calendarDateOf, roundToPrecision } from "./decimal";
import { computedOrder } from "./dependencies";
import { evaluateRaw } from "./expression";
import { semanticValuesOf } from "./semantic";
import type {
  ExpressionContext,
  FieldDef,
  FieldType,
  StoredValues,
} from "./types";

/**
 * 計算欄位與固定值欄位的值(Spec §5:前端即時算供預覽,送出時後端重算並以後端為準)。
 * 本檔只管「算」;隱藏清空、受保護守門等寫入規則由 api 依 Spec §5「不能填的四種原因」處理。
 */

/**
 * 把表達式結果轉成該型別的**存值**,轉不了 → null:
 * - number:取到 `precision` 位的十進位字串
 * - date:收斂成 `YYYY-MM-DD`(以 `timezone` 換算日曆日)—— `now` 回的是 ISO 時間,不能原樣存進日期欄
 * - text / multiline:字串(decimal 不取位轉字串)
 */
export function coerceComputedResult(
  type: FieldType,
  precision: number | undefined,
  result: unknown,
  timezone = "UTC",
): unknown {
  if (result === null || result === undefined) {
    return null;
  }
  switch (type) {
    case "number": {
      return roundToPrecision(result, precision ?? 0);
    }
    case "boolean": {
      return typeof result === "boolean" ? result : null;
    }
    case "date": {
      return calendarDateOf(result, timezone);
    }
    case "text":
    case "multiline": {
      if (typeof result === "string") {
        return result;
      }
      // decimal 物件(算術結果)在這裡轉成不取位的字串
      if (result instanceof FormDecimal) {
        return result.toString();
      }
      return typeof result === "number" || typeof result === "boolean"
        ? String(result)
        : null;
    }
    default: {
      return null;
    }
  }
}

export interface ComputeInput {
  /** 目前的存值(使用者輸入 + 既有值)。 */
  values: StoredValues;
  ctx: ExpressionContext;
}

/**
 * 算一個計算欄位;`semantic` 是算到此刻為止的語意值(含前面已算好的計算欄位)。
 * 非計算欄位回 undefined(呼叫端不該拿它來算)。
 */
export function computeField(
  field: FieldDef,
  fields: readonly FieldDef[],
  semantic: Record<string, unknown>,
  input: ComputeInput,
): unknown {
  if (field.valueSource.kind === "constant") {
    return constantValueOf(field);
  }
  if (field.valueSource.kind !== "computed") {
    return undefined;
  }
  let raw: unknown;
  try {
    raw = evaluateRaw(field.valueSource.expr, {
      values: semantic,
      ctx: input.ctx,
      fields,
      stored: input.values,
    });
  } catch {
    // 形狀錯誤由檢查器擋;執行期的意外(型別不合)一律視為算不出來
    return null;
  }
  return coerceComputedResult(
    field.type,
    field.precision,
    raw,
    input.ctx.timezone,
  );
}

/** 固定值欄位的存值:number 依 `precision` 取位(與計算結果同一條),其餘照定義值。 */
function constantValueOf(field: FieldDef): unknown {
  if (field.valueSource.kind !== "constant") {
    return null;
  }
  const value = field.valueSource.value ?? null;
  if (field.type === "number" && value !== null) {
    return roundToPrecision(value, field.precision ?? 0);
  }
  return value;
}

/**
 * 依拓樸順序算完全部計算欄位與固定值欄位,回傳 `{ fieldKey: 存值 }`(只含這兩類欄位)。
 * 公式引用成圈 → `ComputedCycleError`(檢查器應先擋)。
 */
export function computeAll(
  fields: readonly FieldDef[],
  input: ComputeInput,
): Record<string, unknown> {
  const results: Record<string, unknown> = {};
  const stored: StoredValues = { ...input.values };
  for (const field of fields) {
    if (field.valueSource.kind === "constant") {
      results[field.key] = constantValueOf(field);
      stored[field.key] = results[field.key];
    }
  }
  for (const field of computedOrder(fields)) {
    const semantic = semanticValuesOf(fields, stored);
    const value = computeField(field, fields, semantic, {
      ...input,
      values: stored,
    });
    results[field.key] = value;
    stored[field.key] = value;
  }
  return results;
}
