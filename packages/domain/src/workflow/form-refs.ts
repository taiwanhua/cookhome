import { fieldProtections, isProtected } from "../form/dependencies";
import { scanExpression } from "../form/expression-shape";
import type { Expression, FieldDef } from "../form/types";

/**
 * 流程對表單欄位的兩種引用(`field` 審核者來源、`skipWhen` 跳過條件)的共用檢查:
 * 定義檢查器(發布前、對表單**目前版本**)與送出時檢查(對**這筆提交綁的版本**)用同一份。
 */

/** 使用者型引用欄:`reference` 且來源 provider 是 `user`(6a lookup 登錄表)。 */
export function isUserReferenceField(field: FieldDef | undefined): boolean {
  return field?.type === "reference" && field.source?.provider === "user";
}

/** `field` 來源對某版欄位的問題:欄位不存在、或不是使用者型引用欄。 */
export type AssigneeFieldProblem = "FIELD_MISSING" | "FIELD_NOT_USER_REFERENCE";

export function assigneeFieldProblem(
  fields: readonly FieldDef[],
  fieldKey: string,
): AssigneeFieldProblem | null {
  const field = fields.find((candidate) => candidate.key === fieldKey);
  if (field === undefined) {
    return "FIELD_MISSING";
  }
  return isUserReferenceField(field) ? null : "FIELD_NOT_USER_REFERENCE";
}

/** 跳過條件的一個問題(形狀不合法 / 引用不存在的欄位 / 引用受保護欄位)。 */
export interface SkipWhenProblem {
  problem: "UNKNOWN_OPERATOR" | "INVALID" | "UNKNOWN_FIELD" | "PROTECTED_FIELD";
  /** 表達式樹裡的位置(根為空字串)。 */
  path: string;
  fieldKey?: string;
  detail: string;
}

/**
 * 跳過條件的檢查。`fields` 不給 = 只檢查形狀(沒有可對照的表單)。
 * 受保護欄位(自己設 show、或計算依賴鏈上有受保護欄位)不准引用:從「有沒有跳過」就能猜出機密值。
 */
export function skipWhenProblems(
  expr: Expression,
  fields: readonly FieldDef[] | null,
): SkipWhenProblem[] {
  const scan = scanExpression(expr);
  const problems: SkipWhenProblem[] = scan.issues.map((issue) => ({
    problem:
      issue.problem === "UNKNOWN_OPERATOR" ? "UNKNOWN_OPERATOR" : "INVALID",
    path: issue.path,
    detail: issue.detail,
  }));
  if (fields === null) {
    return problems;
  }
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const protections = fieldProtections(fields);
  for (const ref of scan.refs) {
    if (!byKey.has(ref.fieldKey)) {
      problems.push({
        problem: "UNKNOWN_FIELD",
        path: ref.path,
        fieldKey: ref.fieldKey,
        detail: `欄位 ${ref.fieldKey} 不存在`,
      });
    } else if (isProtected(protections.get(ref.fieldKey))) {
      problems.push({
        problem: "PROTECTED_FIELD",
        path: ref.path,
        fieldKey: ref.fieldKey,
        detail: `欄位 ${ref.fieldKey} 是受保護欄位`,
      });
    }
  }
  return problems;
}
