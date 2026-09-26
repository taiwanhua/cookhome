import {
  DEFAULT_DATE_DIFF_UNIT,
  EXPRESSION_OPERATORS,
  type Expression,
  OPERATOR_SIGNATURES,
  type OperatorSignature,
} from "@repo/domain/form";

/**
 * 設計器的**結構化表達式選擇器**(Spec 6a §5「表達式」:欄位 / 運算 / 常數,可巢狀;不做文字輸入)
 * 在 JSONLogic 樹上的操作。每個節點是四種之一:
 *
 * - `field`:`{ "var": "qty" }`
 * - `context`:`{ "var": "ctx.now" }`(畫面上叫「系統值」,路徑白名單 `CONTEXT_VAR_PATHS`)
 * - `constant`:字串 / 數字 / 布林 / 日期(`YYYY-MM-DD` 字串)/ 清單(字串陣列)/ null
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

/**
 * 新建運算節點時預設幾個參數(變長運算子之後可再增減;`now` 沒有參數、`optionLabel` 參數是欄位 key 字串、
 * `dateDiff` 第三個是單位)。
 */
const DEFAULT_ARITY: Partial<Record<string, number>> = {
  "!": 1,
  "!!": 1,
  if: 3,
  now: 0,
  optionLabel: 1,
  dateDiff: 3,
};

/** 新建時就有值的參數位置(`dateDiff` 的單位預設 `days`);其餘補 null。 */
const DEFAULT_ARGS: Partial<
  Record<string, Partial<Record<number, Expression>>>
> = { dateDiff: { 2: DEFAULT_DATE_DIFF_UNIT } };

const defaultArgOf = (operator: string, index: number): Expression =>
  DEFAULT_ARGS[operator]?.[index] ?? null;

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
  [operator]: Array.from({ length: arityOf(operator) }, (_item, index) =>
    defaultArgOf(operator, index),
  ),
});

/** 運算節點改參數:`update` 收到目前的參數陣列、回新的陣列(運算子不變)。 */
export const withArgs = (
  expr: Expression,
  update: (args: Expression[]) => Expression[],
): OperationExpression => {
  const operator = operatorOf(expr) ?? "and";
  return { [operator]: update(argsOf(expr)) };
};

const signatureOf = (operator: string): OperatorSignature | undefined =>
  (OPERATOR_SIGNATURES as Readonly<Partial<Record<string, OperatorSignature>>>)[
    operator
  ];

/** 兩個運算子的參數與回傳型別一樣(同一族:等於 / 不等於、加 / 乘…)。 */
const isSameFamily = (left: string, right: string): boolean => {
  const before = signatureOf(left);
  const after = signatureOf(right);
  if (before === undefined || after === undefined) {
    return false;
  }
  return (
    before.returns === after.returns &&
    JSON.stringify(before.params) === JSON.stringify(after.params)
  );
};

/**
 * 換運算子:同一族(參數與回傳型別相同,如「等於」換「不等於」)保留參數、數量不夠補預設;
 * 換到別族就**重設**成新運算子的預設參數(型別導向:數字參數留到串接只會變成選不到的舊值)。
 */
export const withOperator = (
  expr: Expression,
  operator: string,
): OperationExpression => {
  const previous = operatorOf(expr);
  if (previous === null || !isSameFamily(previous, operator)) {
    return operationNode(operator);
  }
  const args = argsOf(expr);
  const missing = Array.from(
    { length: Math.max(0, arityOf(operator) - args.length) },
    (_item, index) => defaultArgOf(operator, args.length + index),
  );
  return { [operator]: [...args, ...missing] };
};

/** 常數的種類(選擇器先選種類再填值,不從文字猜型別;日期 = `YYYY-MM-DD` 字串、清單 = 字串陣列)。 */
export const CONSTANT_KINDS = [
  "text",
  "number",
  "boolean",
  "date",
  "list",
  "null",
] as const;

export type ConstantKind = (typeof CONSTANT_KINDS)[number];

const DATE_CONSTANT = /^\d{4}-\d{2}-\d{2}$/;

export const constantKindOf = (expr: Expression): ConstantKind => {
  if (typeof expr === "number") {
    return "number";
  }
  if (typeof expr === "boolean") {
    return "boolean";
  }
  if (typeof expr === "string") {
    return DATE_CONSTANT.test(expr) ? "date" : "text";
  }
  return Array.isArray(expr) ? "list" : "null";
};

/** 換常數種類時的起點值(日期取今天:只在事件處理內呼叫,不在 render 期間讀時間)。 */
const CONSTANT_DEFAULTS: Readonly<Record<ConstantKind, () => Expression>> = {
  text: () => "",
  number: () => 0,
  boolean: () => true,
  date: () => new Date().toISOString().slice(0, 10),
  list: () => [],
  null: () => null,
};

export const constantDefaultOf = (kind: ConstantKind): Expression =>
  CONSTANT_DEFAULTS[kind]();

/** 清單常數在輸入框裡以頓號或逗號分隔。 */
const LIST_SEPARATOR = /[,，、]/u;

export const constantText = (expr: Expression): string => {
  if (Array.isArray(expr)) {
    return expr.map((item) => constantText(item)).join(",");
  }
  return expr === null || typeof expr === "object" ? "" : String(expr);
};

/** 輸入框的字 → 清單常數(去空白、去空項)。 */
export const listConstantOf = (text: string): Expression[] =>
  text
    .split(LIST_SEPARATOR)
    .map((item) => item.trim())
    .filter((item) => item !== "");
