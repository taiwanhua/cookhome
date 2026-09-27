import type { CONTEXT_VAR_PATHS, ExpressionOperator } from "./expression-shape";
import { isDateTimeString } from "./temporal";
import type { Expression, FieldType } from "./types";

/**
 * 表達式的**型別表**(Spec 6a §5「表達式選擇器:型別導向(表 B)」):運算子的參數 / 回傳型別、
 * 欄位與系統值(`ctx.*`)在表達式裡的型別。純資料 + 純函式,設計器的選擇器(每個位置只列型別對得上的
 * 欄位 / 常數 / 系統值 / 運算)與檢查器共用這一張,兩邊不會各說各話。
 */

/** 表達式裡的值型別(語意值,不是存值;`list` = 多選欄的 `value[]` 或常數清單)。 */
export const EXPRESSION_VALUE_TYPES = [
  "text",
  "number",
  "boolean",
  "date",
  "datetime",
  "list",
] as const;

export type ExpressionValueType = (typeof EXPRESSION_VALUE_TYPES)[number];

/** 某個位置可以放的型別;`null` = 不限(例:「有值」的參數)。 */
export type ExpectedTypes = readonly ExpressionValueType[] | null;

/**
 * 欄位型別 → 表達式型別(`var` 讀到的語意值,Spec §5「表達式看到的是語意值」):
 * 單選 = value 字串、多選 = `value[]`、引用 = 來源 id(文字)。**上傳欄不可進表達式**(null)。
 */
export const FIELD_EXPRESSION_TYPES: Readonly<
  Record<FieldType, ExpressionValueType | null>
> = {
  text: "text",
  multiline: "text",
  number: "number",
  date: "date",
  datetime: "datetime",
  select: "text",
  multiSelect: "list",
  boolean: "boolean",
  upload: null,
  reference: "text",
};

/** 系統值(畫面上的「系統值」= `ctx.*`)的型別:現在時間 = 日期時間,其餘是文字。 */
export const CONTEXT_VAR_TYPES: Readonly<
  Record<(typeof CONTEXT_VAR_PATHS)[number], ExpressionValueType>
> = {
  "ctx.now": "datetime",
  "ctx.timezone": "text",
  "ctx.user.id": "text",
  "ctx.user.orgId": "text",
};

/** `dateDiff` 的第三參數(單位);缺參數 = `days`。 */
export const DATE_DIFF_UNITS = ["days", "hours", "minutes"] as const;

export type DateDiffUnit = (typeof DATE_DIFF_UNITS)[number];

export const DEFAULT_DATE_DIFF_UNIT: DateDiffUnit = "days";

/** 設計器單位下拉開放的單位(計算器三種都算:日曆日 / 精確小時 / 精確分鐘)。 */
export const PICKABLE_DATE_DIFF_UNITS: readonly DateDiffUnit[] =
  DATE_DIFF_UNITS;

/** 是不是 `dateDiff` 認得的單位字串。 */
export function isDateDiffUnit(value: unknown): value is DateDiffUnit {
  return (
    typeof value === "string" &&
    (DATE_DIFF_UNITS as readonly string[]).includes(value)
  );
}

/**
 * 一個參數位置要什麼:
 * - `types`:這幾種型別之一(`null` = 不限)
 * - `sameAs`:與第 `index` 個參數同型別(比較的右邊、`if` 的「否則」)
 * - `result`:與這個運算節點**被期望的型別**相同(`if` 的「然後」)
 * - `optionField`:選項欄位的 key 字串(`optionLabel`)
 * - `dateUnit`:`dateDiff` 的單位字串
 */
export type ParamSpec =
  | { kind: "types"; types: ExpectedTypes }
  | { kind: "sameAs"; index: number }
  | { kind: "result" }
  | { kind: "optionField" }
  | { kind: "dateUnit" };

export interface OperatorSignature {
  /** 固定位置的參數 */
  params: readonly ParamSpec[];
  /** 可再加的參數(變長運算子:加、乘、且、或、串接…);沒有 = 參數數量固定 */
  rest?: ParamSpec;
  /** 回傳型別;`then` = 與「然後」同型別(`if`) */
  returns: ExpressionValueType | "then";
}

const NUMBERS: ParamSpec = { kind: "types", types: ["number"] };
const BOOLEANS: ParamSpec = { kind: "types", types: ["boolean"] };
const TEXTS: ParamSpec = { kind: "types", types: ["text"] };
const TEMPORALS: ParamSpec = { kind: "types", types: ["date", "datetime"] };
const SAME_AS_FIRST: ParamSpec = { kind: "sameAs", index: 0 };

/** 等不等於:兩邊同型別,任何單值型別都能比。 */
const EQUALITY: OperatorSignature = {
  params: [
    {
      kind: "types",
      types: ["text", "number", "boolean", "date", "datetime"],
    },
    SAME_AS_FIRST,
  ],
  returns: "boolean",
};

/** 大小比較:兩邊同型別,限可排序的型別。 */
const ORDERING: OperatorSignature = {
  params: [
    { kind: "types", types: ["number", "date", "datetime", "text"] },
    SAME_AS_FIRST,
  ],
  returns: "boolean",
};

const ARITHMETIC: OperatorSignature = {
  params: [NUMBERS, NUMBERS],
  rest: NUMBERS,
  returns: "number",
};

const BINARY_ARITHMETIC: OperatorSignature = {
  params: [NUMBERS, NUMBERS],
  returns: "number",
};

/** 每個運算子(`var` 以外)的簽章 —— 表 B。 */
export const OPERATOR_SIGNATURES: Readonly<
  Record<Exclude<ExpressionOperator, "var">, OperatorSignature>
> = {
  "+": ARITHMETIC,
  "*": ARITHMETIC,
  min: ARITHMETIC,
  max: ARITHMETIC,
  "-": BINARY_ARITHMETIC,
  "/": BINARY_ARITHMETIC,
  "%": BINARY_ARITHMETIC,
  "==": EQUALITY,
  "!=": EQUALITY,
  "===": EQUALITY,
  "!==": EQUALITY,
  "<": ORDERING,
  ">": ORDERING,
  "<=": ORDERING,
  ">=": ORDERING,
  and: { params: [BOOLEANS, BOOLEANS], rest: BOOLEANS, returns: "boolean" },
  or: { params: [BOOLEANS, BOOLEANS], rest: BOOLEANS, returns: "boolean" },
  "!": { params: [BOOLEANS], returns: "boolean" },
  // 「有值」:任何型別都能問有沒有值(只收是 / 否就等於原值,沒有用途)
  "!!": { params: [{ kind: "types", types: null }], returns: "boolean" },
  in: {
    params: [
      { kind: "types", types: ["text", "number"] },
      { kind: "types", types: ["list"] },
    ],
    returns: "boolean",
  },
  if: {
    params: [BOOLEANS, { kind: "result" }, { kind: "sameAs", index: 1 }],
    returns: "then",
  },
  dateDiff: {
    params: [TEMPORALS, TEMPORALS, { kind: "dateUnit" }],
    returns: "number",
  },
  concat: { params: [TEXTS, TEXTS], rest: TEXTS, returns: "text" },
  optionLabel: { params: [{ kind: "optionField" }], returns: "text" },
  now: { params: [], returns: "datetime" },
};

const TEMPORAL_TYPES = new Set<ExpressionValueType>(["date", "datetime"]);

/** 比較運算子(等不等於、大小):右邊要與左邊**完全同型**,日期與日期時間不互通。 */
const COMPARISON_OPERATORS = new Set<string>([
  "==",
  "!=",
  "===",
  "!==",
  "<",
  ">",
  "<=",
  ">=",
]);

/**
 * 「嚴格」的期望型別(日期與日期時間不互通):`expectedTypesAt` 為比較運算子的右邊回的陣列會登記在這裡。
 * 以陣列身分登記(不改 `ExpectedTypes` 的形狀),設計器與檢查器拿到同一個陣列、判法自然一致。
 */
const STRICT_EXPECTATIONS = new WeakSet<readonly ExpressionValueType[]>();

function strictTypes(
  types: readonly ExpressionValueType[],
): readonly ExpressionValueType[] {
  STRICT_EXPECTATIONS.add(types);
  return types;
}

/**
 * `actual` 能不能放進要 `expected` 的位置:型別相同即可;日期與日期時間互通
 * (Spec 表 B:「現在時間」可放日期 / 日期時間位置,`dateDiff` 兩種都收)——
 * **比較運算子的右邊除外**:日期與日期時間比較會變成字串比較的怪結果,要求同型(要比請用 `dateDiff`)。
 */
export function isTypeAccepted(
  actual: ExpressionValueType,
  expected: ExpectedTypes,
): boolean {
  if (expected === null) {
    return true;
  }
  const isStrict = STRICT_EXPECTATIONS.has(expected);
  return expected.some(
    (type) =>
      type === actual ||
      (!isStrict && TEMPORAL_TYPES.has(type) && TEMPORAL_TYPES.has(actual)),
  );
}

/** 運算子的回傳型別能不能放進 `expected`(`if` 回「然後」的型別,任何位置都能放)。 */
export function isOperatorAccepted(
  operator: Exclude<ExpressionOperator, "var">,
  expected: ExpectedTypes,
): boolean {
  const { returns } = OPERATOR_SIGNATURES[operator];
  return returns === "then" || isTypeAccepted(returns, expected);
}

/** 第 `index` 個參數的規格(超過固定位置時看 `rest`;沒有 `rest` 回 null = 多出來的參數)。 */
export function paramSpecAt(
  operator: Exclude<ExpressionOperator, "var">,
  index: number,
): ParamSpec | null {
  const signature = OPERATOR_SIGNATURES[operator];
  return signature.params[index] ?? signature.rest ?? null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 常數的型別:`YYYY-MM-DD` 字串視為日期、帶時區的 ISO 日期時間字串視為日期時間、陣列視為清單;
 * null 沒有型別。
 */
export function constantTypeOf(expr: Expression): ExpressionValueType | null {
  if (typeof expr === "number") {
    return "number";
  }
  if (typeof expr === "boolean") {
    return "boolean";
  }
  if (typeof expr === "string") {
    if (DATE_PATTERN.test(expr)) {
      return "date";
    }
    return isDateTimeString(expr) ? "datetime" : "text";
  }
  return Array.isArray(expr) ? "list" : null;
}

/** 欄位 key → 表達式型別(不存在或不可進表達式回 null)。 */
export type FieldTypeLookup = (fieldKey: string) => ExpressionValueType | null;

const isOperationNode = (
  expr: Expression,
): expr is Record<string, Expression> =>
  typeof expr === "object" && expr !== null && !Array.isArray(expr);

const argsOf = (value: Expression | undefined): Expression[] => {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

/**
 * 推斷表達式回傳的型別(不求值);推不出來(未知運算子、空參數、`if` 的「然後」是 null)回 null。
 * 與 `OPERATOR_SIGNATURES` 同一張表,設計器用它決定「比較的右邊要什麼型別」。
 */
export function inferExpressionType(
  expr: Expression,
  fieldTypeOf: FieldTypeLookup,
): ExpressionValueType | null {
  if (!isOperationNode(expr)) {
    return constantTypeOf(expr);
  }
  const [operator] = Object.keys(expr);
  if (operator === undefined) {
    return null;
  }
  if (operator === "var") {
    const [path] = argsOf(expr.var);
    if (typeof path !== "string") {
      return null;
    }
    if (!path.startsWith("ctx.")) {
      return fieldTypeOf(path);
    }
    const contextTypes: Readonly<Partial<Record<string, ExpressionValueType>>> =
      CONTEXT_VAR_TYPES;
    return contextTypes[path] ?? null;
  }
  const signature = (
    OPERATOR_SIGNATURES as Readonly<Partial<Record<string, OperatorSignature>>>
  )[operator];
  if (signature === undefined) {
    return null;
  }
  if (signature.returns !== "then") {
    return signature.returns;
  }
  const [, thenBranch = null, elseBranch = null] = argsOf(expr[operator]);
  return (
    inferExpressionType(thenBranch, fieldTypeOf) ??
    inferExpressionType(elseBranch, fieldTypeOf)
  );
}

/** 由欄位清單建 `FieldTypeLookup`。 */
export function fieldTypeLookupOf(
  fields: readonly { key: string; type: FieldType }[],
): FieldTypeLookup {
  const types = new Map(
    fields.map((field) => [field.key, FIELD_EXPRESSION_TYPES[field.type]]),
  );
  return (fieldKey) => types.get(fieldKey) ?? null;
}

/**
 * 運算節點第 `index` 個參數位置**要什麼型別**:
 * `sameAs` 看那個參數推得出的型別(推不出來就退回那個參數自己的限制;比較運算子的右邊是嚴格同型);
 * `result` = 這個運算節點被期望的型別(`nodeExpected`);`optionField` / `dateUnit` 不是一般值,回空陣列。
 */
export function expectedTypesAt(
  operator: Exclude<ExpressionOperator, "var">,
  index: number,
  args: readonly Expression[],
  nodeExpected: ExpectedTypes,
  fieldTypeOf: FieldTypeLookup,
): ExpectedTypes {
  const spec = paramSpecAt(operator, index);
  if (spec === null) {
    return null;
  }
  switch (spec.kind) {
    case "types": {
      return spec.types;
    }
    case "result": {
      return nodeExpected;
    }
    case "sameAs": {
      const source = args[spec.index] ?? null;
      const inferred = inferExpressionType(source, fieldTypeOf);
      if (inferred === null) {
        return expectedTypesAt(
          operator,
          spec.index,
          args,
          nodeExpected,
          fieldTypeOf,
        );
      }
      return COMPARISON_OPERATORS.has(operator)
        ? strictTypes([inferred])
        : [inferred];
    }
    case "optionField":
    case "dateUnit": {
      return [];
    }
  }
}
