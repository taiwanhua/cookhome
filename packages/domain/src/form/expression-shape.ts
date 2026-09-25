import type { Expression } from "./types";

/**
 * 表達式的**形狀**檢查(不求值):白名單運算子、深度 / 節點上限、`var` 路徑。
 * 計算器求值前與檢查器都走這裡,所以兩邊擋的東西一模一樣(Spec §5「表達式」的限制)。
 */

/** 允許的運算子。沒有任何正則運算子(正則只在 `rules.pattern`);未列者一律拒絕。 */
export const EXPRESSION_OPERATORS = [
  "var",
  "if",
  "==",
  "!=",
  "===",
  "!==",
  "!",
  "!!",
  "and",
  "or",
  "<",
  ">",
  "<=",
  ">=",
  "+",
  "-",
  "*",
  "/",
  "%",
  "min",
  "max",
  "in",
  "dateDiff",
  "concat",
  "optionLabel",
  "now",
] as const;

export type ExpressionOperator = (typeof EXPRESSION_OPERATORS)[number];

/** 運算子巢狀深度上限。 */
export const MAX_EXPRESSION_DEPTH = 10;

/** 節點總數上限(運算子、陣列、常數都算一個節點)。 */
export const MAX_EXPRESSION_NODES = 200;

/** `var` 可讀的上下文路徑(`ctx.*`)。 */
export const CONTEXT_VAR_PATHS = [
  "ctx.now",
  "ctx.timezone",
  "ctx.user.id",
  "ctx.user.orgId",
] as const;

/** 欄位的 `var` 路徑:單一段,不含 `.`(欄位 key 本來就不准有 `.`)。 */
const FIELD_VAR_PATH = /^[a-z][a-z0-9_]*$/;

export type ExpressionShapeProblem =
  | "UNKNOWN_OPERATOR"
  | "INVALID_NODE"
  | "INVALID_VAR"
  | "TOO_DEEP"
  | "TOO_MANY_NODES";

export interface ExpressionShapeIssue {
  problem: ExpressionShapeProblem;
  /** 在表達式樹裡的位置,以 `.` 串接(如 `*.0.var`);根為空字串。 */
  path: string;
  detail: string;
}

/** 表達式引用到的一個欄位(`var` 或 `optionLabel` 的欄位 key)。 */
export interface ExpressionFieldRef {
  fieldKey: string;
  path: string;
}

export interface ExpressionScan {
  issues: ExpressionShapeIssue[];
  refs: ExpressionFieldRef[];
  /** 用到 `ctx.*` 或 `now()` — 用來判斷「常數」表達式。 */
  usesContext: boolean;
}

const OPERATOR_SET = new Set<string>(EXPRESSION_OPERATORS);

/** 一次走完整棵樹:收集形狀問題與欄位引用。 */
export function scanExpression(expr: Expression): ExpressionScan {
  const scan: ExpressionScan = { issues: [], refs: [], usesContext: false };
  const counter = { nodes: 0 };
  walk(expr, "", 0, scan, counter);
  if (counter.nodes > MAX_EXPRESSION_NODES) {
    scan.issues.push({
      problem: "TOO_MANY_NODES",
      path: "",
      detail: `節點數 ${String(counter.nodes)} 超過上限 ${String(MAX_EXPRESSION_NODES)}`,
    });
  }
  return scan;
}

function joinPath(base: string, segment: string | number): string {
  return base === "" ? String(segment) : `${base}.${String(segment)}`;
}

function walk(
  node: Expression,
  path: string,
  depth: number,
  scan: ExpressionScan,
  counter: { nodes: number },
): void {
  counter.nodes += 1;
  if (node === null || typeof node !== "object") {
    return;
  }
  if (Array.isArray(node)) {
    for (const [index, child] of node.entries()) {
      walk(child, joinPath(path, index), depth, scan, counter);
    }
    return;
  }
  const keys = Object.keys(node);
  if (keys.length !== 1) {
    scan.issues.push({
      problem: "INVALID_NODE",
      path,
      detail: "運算子節點必須恰好一個鍵",
    });
    return;
  }
  const operator = keys[0] ?? "";
  const operatorPath = joinPath(path, operator);
  if (!OPERATOR_SET.has(operator)) {
    scan.issues.push({
      problem: "UNKNOWN_OPERATOR",
      path: operatorPath,
      detail: `未知運算子 ${operator}`,
    });
    return;
  }
  if (depth + 1 > MAX_EXPRESSION_DEPTH) {
    scan.issues.push({
      problem: "TOO_DEEP",
      path: operatorPath,
      detail: `巢狀深度超過上限 ${String(MAX_EXPRESSION_DEPTH)}`,
    });
    return;
  }
  const argument = node[operator] ?? null;
  if (operator === "var") {
    checkVar(argument, operatorPath, scan);
    counter.nodes += 1;
    return;
  }
  if (operator === "optionLabel") {
    checkOptionLabel(argument, operatorPath, scan);
    counter.nodes += 1;
    return;
  }
  if (operator === "now") {
    scan.usesContext = true;
  }
  walk(argument, operatorPath, depth + 1, scan, counter);
}

/** `var` 只收常數字串(或 `[路徑, 預設值]`),路徑必須是欄位 key 或 `ctx.*`。 */
function checkVar(
  argument: Expression,
  path: string,
  scan: ExpressionScan,
): void {
  const target = Array.isArray(argument) ? argument[0] : argument;
  const fallback = Array.isArray(argument) ? argument[1] : undefined;
  const isFallbackLiteral =
    fallback === undefined || fallback === null || typeof fallback !== "object";
  if (typeof target !== "string" || !isFallbackLiteral) {
    scan.issues.push({
      problem: "INVALID_VAR",
      path,
      detail: "var 的路徑必須是常數字串",
    });
    return;
  }
  if ((CONTEXT_VAR_PATHS as readonly string[]).includes(target)) {
    scan.usesContext = true;
    return;
  }
  if (!FIELD_VAR_PATH.test(target)) {
    scan.issues.push({
      problem: "INVALID_VAR",
      path,
      detail: `var 路徑 ${target} 不是欄位 key 也不是 ctx.*`,
    });
    return;
  }
  scan.refs.push({ fieldKey: target, path });
}

function checkOptionLabel(
  argument: Expression,
  path: string,
  scan: ExpressionScan,
): void {
  const target = Array.isArray(argument) ? argument[0] : argument;
  if (typeof target !== "string" || !FIELD_VAR_PATH.test(target)) {
    scan.issues.push({
      problem: "INVALID_VAR",
      path,
      detail: "optionLabel 的參數必須是欄位 key 常數",
    });
    return;
  }
  scan.refs.push({ fieldKey: target, path });
}

/** 表達式引用到的欄位 key(去重);形狀有問題的節點不列。 */
export function referencedFieldKeys(expr: Expression): string[] {
  return [...new Set(scanExpression(expr).refs.map((ref) => ref.fieldKey))];
}
