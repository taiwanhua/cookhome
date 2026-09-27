import { evaluateCondition } from "../form/expression";
import { semanticValuesOf } from "../form/semantic";
import type { ExpressionContext, FieldDef, StoredValues } from "../form/types";
import type { PlanItem, ReviewStepDef } from "./types";

/**
 * 進關時要算的兩件事(Spec §6 列 5):跳過條件、派任計畫。
 * 審核者的**解析**要查資料庫(角色成員、主管、使用者狀態),由 api 做;
 * 這裡只負責「拿到名單之後」的純規則:去重、剔除申請人、編 `taskKey`。
 */

/** 送出的那份表單內容(跳過條件的求值對象;同一實例內固定)。 */
export interface SkipEvaluationInput {
  /** 該修訂綁的表單版本欄位。 */
  fields: readonly FieldDef[];
  /** 該修訂的存值快照。 */
  values: StoredValues;
  /** 送出當時的上下文(時間用送出當時,不用推進當下)。 */
  ctx: ExpressionContext;
}

/**
 * 跳過條件:沒設 → false(永遠不跳過);設了就拿送出的表單內容算一次。
 * 算法同 6a 表單公式(下拉欄用選項值、引用欄用 id)。
 */
export function shouldSkipStep(
  step: Pick<ReviewStepDef, "skipWhen">,
  input: SkipEvaluationInput,
): boolean {
  if (step.skipWhen === undefined || step.skipWhen === null) {
    return false;
  }
  return evaluateCondition(step.skipWhen, {
    values: semanticValuesOf(input.fields, input.values),
    ctx: input.ctx,
    fields: input.fields,
    stored: input.values,
  });
}

/** `taskKey = "<stepKey>-<seq>"`(seq 從 1 起;改派不變)。 */
export function taskKeyOf(stepKey: string, seq: number): string {
  return `${stepKey}-${String(seq)}`;
}

/**
 * 派任計畫:解析到的審核者去重、剔除申請人(不能自審),每人一項,`taskKey` 依序編。
 * 剔除後為空 → 空陣列(呼叫端依來源決定:`manager` 往上一層在解析時就做完了,其餘阻擋)。
 */
export function buildPlan(
  stepKey: string,
  assigneeIds: readonly string[],
  applicantId: string,
): PlanItem[] {
  const unique = [...new Set(assigneeIds)].filter((id) => id !== applicantId);
  return unique.map((assigneeId, index) => ({
    taskKey: taskKeyOf(stepKey, index + 1),
    assigneeId,
    previousAssigneeIds: [],
    assigneeState: "active",
  }));
}

/** 新增審核者時的下一個 `taskKey`(接在計畫最大序號之後,不重用)。 */
export function nextTaskKey(
  stepKey: string,
  plan: readonly Pick<PlanItem, "taskKey">[],
): string {
  const prefix = `${stepKey}-`;
  const maxSeq = plan.reduce((max, item) => {
    const seq = item.taskKey.startsWith(prefix)
      ? Number(item.taskKey.slice(prefix.length))
      : 0;
    return Number.isInteger(seq) && seq > max ? seq : max;
  }, 0);
  return taskKeyOf(stepKey, maxSeq + 1);
}
