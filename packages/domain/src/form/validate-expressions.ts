import { type FieldProtection, isProtected } from "./dependencies";
import { evaluateCondition } from "./expression";
import {
  type ExpressionShapeProblem,
  referencedFieldKeys,
  scanExpression,
} from "./expression-shape";
import type {
  DefinitionErrorCode,
  ExpressionSlot,
  IssueCollector,
} from "./issues";
import type { Expression, FieldDef } from "./types";

/**
 * 檢查器的表達式段(Spec §5「定義檢查器」表達式一列):形狀、引用、循環(含跨類型)、
 * `visibleWhen` 自我引用、條件引用受保護欄位,以及「顯示條件恆為 false 卻必填」。
 */

const SHAPE_CODES: Record<ExpressionShapeProblem, DefinitionErrorCode> = {
  UNKNOWN_OPERATOR: "EXPR_UNKNOWN_OPERATOR",
  INVALID_NODE: "EXPR_INVALID",
  INVALID_VAR: "EXPR_INVALID_VAR",
  TOO_DEEP: "EXPR_TOO_DEEP",
  TOO_MANY_NODES: "EXPR_TOO_MANY_NODES",
};

/** 條件類表達式:v1 禁止引用受保護欄位(「某欄有沒有出現」會洩漏它的值)。 */
const CONDITION_SLOTS = new Set<ExpressionSlot>([
  "visibleWhen",
  "readonlyWhen",
  "rules.custom",
]);

interface SlotExpression {
  slot: ExpressionSlot;
  expr: Expression;
}

/** 欄位上所有有值的表達式(null / undefined = 沒設)。 */
export function expressionsOf(field: FieldDef): SlotExpression[] {
  const slots: SlotExpression[] = [];
  if (field.valueSource.kind === "computed") {
    slots.push({ slot: "valueSource.expr", expr: field.valueSource.expr });
  }
  const optional: [ExpressionSlot, Expression | undefined][] = [
    ["visibleWhen", field.visibleWhen],
    ["readonlyWhen", field.readonlyWhen],
    ["rules.custom", field.rules?.custom],
  ];
  for (const [slot, expr] of optional) {
    if (expr !== undefined && expr !== null) {
      slots.push({ slot, expr });
    }
  }
  return slots;
}

export function validateExpressions(
  fields: readonly FieldDef[],
  protections: ReadonlyMap<string, FieldProtection>,
  collector: IssueCollector,
): void {
  const keys = new Set(fields.map((field) => field.key));
  for (const field of fields) {
    if (
      field.valueSource.kind === "computed" &&
      // 定義來自設計器送來的 JSON,型別保證不了公式一定在
      (field.valueSource as { expr?: unknown }).expr === undefined
    ) {
      collector.error("EXPR_MISSING", `計算欄位「${field.label}」沒有公式`, {
        fieldKey: field.key,
        exprSlot: "valueSource.expr",
      });
    }
    for (const { slot, expr } of expressionsOf(field)) {
      validateOne(field, slot, expr, keys, protections, collector);
    }
    validateRequiredVisibility(field, collector);
  }
  validateCycles(fields, collector);
}

function validateOne(
  field: FieldDef,
  slot: ExpressionSlot,
  expr: Expression,
  keys: ReadonlySet<string>,
  protections: ReadonlyMap<string, FieldProtection>,
  collector: IssueCollector,
): void {
  const scan = scanExpression(expr);
  for (const issue of scan.issues) {
    collector.error(SHAPE_CODES[issue.problem], issue.detail, {
      fieldKey: field.key,
      exprSlot: slot,
      exprPath: issue.path,
    });
  }
  for (const ref of scan.refs) {
    const location = {
      fieldKey: field.key,
      exprSlot: slot,
      exprPath: ref.path,
    };
    if (!keys.has(ref.fieldKey)) {
      collector.error(
        "EXPR_UNKNOWN_FIELD",
        `「${field.label}」的表達式引用了不存在的欄位 ${ref.fieldKey}`,
        location,
      );
      continue;
    }
    if (slot === "visibleWhen" && ref.fieldKey === field.key) {
      collector.error(
        "EXPR_VISIBLE_SELF",
        `「${field.label}」的顯示條件不可引用自己`,
        location,
      );
    }
    if (
      CONDITION_SLOTS.has(slot) &&
      isProtected(protections.get(ref.fieldKey))
    ) {
      collector.error(
        "EXPR_PROTECTED_REF",
        `「${field.label}」的條件不可引用受保護欄位 ${ref.fieldKey}(含因引用受保護欄位而受保護的計算欄位)`,
        location,
      );
    }
  }
}

/** 顯示條件恆為 false(不看任何欄位與上下文、算出來為假)卻必填 → 永遠送不出去。 */
function validateRequiredVisibility(
  field: FieldDef,
  collector: IssueCollector,
): void {
  const expr = field.visibleWhen;
  if (field.rules?.required !== true || expr === undefined || expr === null) {
    return;
  }
  const scan = scanExpression(expr);
  if (scan.issues.length > 0 || scan.refs.length > 0 || scan.usesContext) {
    return;
  }
  const isVisible = evaluateCondition(expr, {
    values: {},
    ctx: { now: "", timezone: "UTC", user: { id: null, orgId: null } },
  });
  if (!isVisible) {
    collector.error(
      "REQUIRED_ALWAYS_HIDDEN",
      `「${field.label}」的顯示條件恆為 false,卻設為必填`,
      { fieldKey: field.key, exprSlot: "visibleWhen" },
    );
  }
}

/**
 * 循環(含跨類型):欄位 A 的值依賴它的公式、顯示條件(隱藏即清空)與唯讀條件(唯讀即保留舊值)
 * 引用到的欄位。這三種邊合成一張圖,任何圈都是錯誤 — 例如「計算欄位 total 引用 qty、
 * qty 的顯示條件又引用 total」。自我引用:公式引用自己算循環;顯示條件引用自己另報
 * `EXPR_VISIBLE_SELF`;唯讀條件引用自己(「超過 5 就鎖住」)是合理用法,不算。
 */
function validateCycles(
  fields: readonly FieldDef[],
  collector: IssueCollector,
): void {
  const edges = new Map<string, string[]>();
  const keys = new Set(fields.map((field) => field.key));
  for (const field of fields) {
    const targets = new Set<string>();
    for (const { slot, expr } of expressionsOf(field)) {
      if (slot === "rules.custom") {
        continue;
      }
      for (const key of referencedFieldKeys(expr)) {
        const isSelf = key === field.key;
        if (keys.has(key) && (!isSelf || slot === "valueSource.expr")) {
          targets.add(key);
        }
      }
    }
    edges.set(field.key, [...targets]);
  }

  const state = new Map<string, "visiting" | "done">();
  const reported = new Set<string>();
  const visit = (key: string, trail: string[]): void => {
    if (state.get(key) === "done") {
      return;
    }
    if (state.get(key) === "visiting") {
      const cycle = [...trail.slice(trail.indexOf(key)), key];
      const signature = cycle
        .slice(0, -1)
        .toSorted((left, right) => left.localeCompare(right, "en"))
        .join(",");
      if (!reported.has(signature)) {
        reported.add(signature);
        collector.error("EXPR_CYCLE", `欄位之間循環引用:${cycle.join(" → ")}`, {
          fieldKey: key,
        });
      }
      return;
    }
    state.set(key, "visiting");
    for (const next of edges.get(key) ?? []) {
      visit(next, [...trail, key]);
    }
    state.set(key, "done");
  };
  for (const field of fields) {
    visit(field.key, []);
  }
}
