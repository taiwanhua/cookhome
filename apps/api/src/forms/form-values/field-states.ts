import {
  type ExpressionContext,
  type FieldDef,
  type StoredValues,
  evaluateCondition,
} from "@repo/domain/form";

import type { FieldGate } from "../field-permission-gate";
import type { FormFieldState } from "../models/form-common.model";
import { REDACTED, semanticOf } from "./stored-values";

function conditionOf(
  expr: FieldDef["visibleWhen"],
  input: Parameters<typeof evaluateCondition>[1],
  fallback: boolean,
): boolean {
  if (expr === undefined || expr === null) {
    return fallback;
  }
  try {
    return evaluateCondition(expr, input);
  } catch {
    return fallback;
  }
}

/**
 * 每一欄的渲染狀態:`visibleWhen` / `readonlyWhen` 以**存的值**與給定的 `ctx` 重算
 * (唯讀檢視用該修訂的 `ctx`,不拿讀者現在的身分或時間補值;草稿用真正的現在與填寫者),
 * `redacted` 看**現在的讀者**有沒有該欄的 `show`(含依賴鏈)。
 * 條件不得引用受保護欄位(檢查器擋),所以用完整存值算不會經由條件洩漏。
 */
export function fieldStatesOf(
  fields: readonly FieldDef[],
  values: StoredValues,
  ctx: ExpressionContext,
  gate: FieldGate,
): FormFieldState[] {
  const input = {
    values: semanticOf(fields, values),
    ctx,
    fields,
    stored: values,
  };
  return fields.map((field) => ({
    key: field.key,
    visible: conditionOf(field.visibleWhen, input, true),
    readonly: conditionOf(field.readonlyWhen, input, false),
    redacted: !gate.canShow(fields, field.key),
  }));
}

/**
 * 讀取投影:讀者沒有 `show` 的欄位(含只因依賴而受保護的計算欄位)→ `"[redacted]"`;
 * 版本定義裡沒有的鍵不回。**不重算、不清空**已存的計算欄位與隱藏欄位的值。
 */
export function projectValues(
  fields: readonly FieldDef[],
  values: StoredValues,
  gate: FieldGate,
): StoredValues {
  const projected: StoredValues = {};
  for (const field of fields) {
    projected[field.key] = gate.canShow(fields, field.key)
      ? (values[field.key] ?? null)
      : REDACTED;
  }
  return projected;
}
