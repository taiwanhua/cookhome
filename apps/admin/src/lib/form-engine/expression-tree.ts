import { EXPRESSION_OPERATORS, type Expression } from "@repo/domain/form";

/**
 * 設計器的**結構化表達式選擇器**(Spec 6a §5「表達式」:欄位 / 運算 / 常數,可巢狀;不做文字輸入)
 * 在 JSONLogic 樹上的操作。每個節點是四種之一:
 *
 * - `field`:`{ "var": "qty" }`
 * - `context`:`{ "var": "ctx.now" }`(上下文,路徑白名單 `CONTEXT_VAR_PATHS`)
 * - `constant`:字串 / 數字 / 布林 / null
 * - `operation`:`{ "<運算子>": [參數…] }`(`var` 以外的白名單運算子)
 */
export type ExpressionNodeKind = "field" | "context" | "constant" | "operation";

/** 選擇器可選的運算子(`var` 由「欄位 / 上下文」兩種節點產生,不在這裡)。 */
export const PICKER_OPERATORS = EXPRESSION_OPERATORS.filter(
  (operator) => operator !== "var",
);

export type PickerOperator = (typeof PICKER_OPERATORS)[number];

/** 運算節點:一個運算子鍵對一串參數。 */
export type OperationExpression = Record<string, Expression[]>;

/** 新建運算節點時預設幾個參數(之後可再增減;`now` 沒有參數、`optionLabel` 參數是欄位 key 字串)。 */
const DEFAULT_ARITY: Partial<Record<string, number>> = {
  "!": 1,
  "!!": 1,
  if: 3,
  now: 0,
  optionLabel: 1,
};

const arityOf = (operator: string): number => DEFAULT_ARITY[operator] ?? 2;

const isRecord = (value: unknown): value is Record<string, Expression> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const operatorOf = (expr: Expression): string | null => {
  if (!isRecord(expr)) {
    return null;
  }
  const keys = Object.keys(expr);
  return keys.length > 0 ? keys[0] : null;
};

export const nodeKindOf = (expr: Expression): ExpressionNodeKind => {
  const operator = operatorOf(expr);
  if (operator === null) {
    return "constant";
  }
  if (operator !== "var") {
    return "operation";
  }
  return varPathOf(expr).startsWith("ctx.") ? "context" : "field";
};

/** `var` 節點的路徑(欄位 key 或 `ctx.*`)。 */
export const varPathOf = (expr: Expression): string => {
  const path = isRecord(expr) ? expr.var : null;
  return typeof path === "string" ? path : "";
};

/** 運算節點的參數(JSONLogic 允許單一參數不包陣列,這裡一律攤成陣列)。 */
export const argsOf = (expr: Expression): Expression[] => {
  const operator = operatorOf(expr);
  if (operator === null || !isRecord(expr)) {
    return [];
  }
  const args = expr[operator];
  return Array.isArray(args) ? args : [args];
};

export const fieldNode = (fieldKey: string): Expression => ({ var: fieldKey });

export const contextNode = (path: string): Expression => ({ var: path });

export const operationNode = (operator: string): OperationExpression => ({
  [operator]: Array.from({ length: arityOf(operator) }, () => null),
});

/** 運算節點改參數:`update` 收到目前的參數陣列、回新的陣列(運算子不變)。 */
export const withArgs = (
  expr: Expression,
  update: (args: Expression[]) => Expression[],
): OperationExpression => {
  const operator = operatorOf(expr) ?? "and";
  return { [operator]: update(argsOf(expr)) };
};

/** 換運算子但保留參數(數量不夠補 null;`now` 一律沒有參數)。 */
export const withOperator = (
  expr: Expression,
  operator: string,
): OperationExpression => {
  if (operator === "now") {
    return { now: [] };
  }
  const args = argsOf(expr);
  const missing = Math.max(0, arityOf(operator) - args.length);
  return {
    [operator]: [...args, ...Array.from({ length: missing }, () => null)],
  };
};

/** 常數的種類(選擇器先選種類再填值,不從文字猜型別)。 */
export type ConstantKind = "text" | "number" | "boolean" | "null";

export const constantKindOf = (expr: Expression): ConstantKind => {
  if (typeof expr === "number") {
    return "number";
  }
  if (typeof expr === "boolean") {
    return "boolean";
  }
  return typeof expr === "string" ? "text" : "null";
};

export const constantText = (expr: Expression): string =>
  expr === null || typeof expr === "object" ? "" : String(expr);
