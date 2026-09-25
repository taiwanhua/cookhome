/* eslint-disable unicorn/no-this-outside-of-class, import-x/no-named-as-default-member -- json-logic-js 以 `this` 把求值資料傳給自訂運算子,且覆寫 `truthy` / `add_operation` 必須改在預設匯出的那個物件上(具名匯入是唯讀綁定);到期條件:換成可建實例、以參數傳資料的 JSONLogic 引擎 */
import jsonLogic from "json-logic-js";

import {
  FormDecimal,
  calendarDayDiff,
  compareChain,
  decimalsOf,
  divide,
  looseEquals,
  strictEquals,
  textOf,
  unwrapDecimal,
} from "./decimal";
import { scanExpression } from "./expression-shape";
import { optionLabelOf } from "./semantic";
import type {
  Expression,
  ExpressionContext,
  FieldDef,
  StoredValues,
} from "./types";

/**
 * 表達式計算器(Spec §5「表達式」):JSONLogic(`json-logic-js`,MIT)+ 擴充函式
 * `dateDiff` / `concat` / `optionLabel` / `now`。
 *
 * - `var` 讀**語意值**(`semanticValuesOf`)與 `ctx.*`;其他路徑在求值前就被形狀檢查擋掉
 * - 算術與比較走 decimal(`decimal.ts`):中間過程不取位,只有 `computeField` 在最後依欄位
 *   `precision` 四捨五入;除以零、空值 → `null`
 * - 求值前一律跑 `scanExpression`:未知運算子 / 深度 / 節點超限 → `ExpressionError`
 */

/** 表達式形狀不合法(未知運算子、超限、`var` 路徑不對);屬定義錯誤,檢查器會先擋。 */
export class ExpressionError extends Error {
  override name = "ExpressionError";
}

/** 藏在求值資料裡給 `optionLabel` 用的鍵;`$` 開頭不可能是欄位 key,`var` 讀不到它。 */
const FORM_DATA_KEY = "$form";

interface FormData {
  fields: ReadonlyMap<string, FieldDef>;
  stored: StoredValues;
}

interface EvaluationData {
  [key: string]: unknown;
  ctx: ExpressionContext;
  [FORM_DATA_KEY]?: FormData;
}

type Operation = (this: EvaluationData, ...args: unknown[]) => unknown;

/**
 * **全域註冊,只在這裡做一次**:`json-logic-js` 的 `add_operation` / `truthy` 是模組層單例,
 * 本 repo 只有這個檔使用 json-logic-js,所以覆寫對整個 process 生效也不影響別人。
 * 若之後別處也要 JSONLogic 原生語意,就得改用可建實例的引擎(如 json-logic-engine)。
 */
function registerOperations(): void {
  const originalTruthy = jsonLogic.truthy.bind(jsonLogic);
  // decimal 物件的真假值看是不是零(不然 0 會因為是物件而被當成 true)
  jsonLogic.truthy = (value: unknown) =>
    value instanceof FormDecimal ? !value.isZero() : originalTruthy(value);

  const operations: Record<string, Operation> = {
    "+": (...args) =>
      decimalsOf(args)?.reduce(
        (sum, item) => sum.plus(item),
        new FormDecimal(0),
      ) ?? null,
    "*": (...args) =>
      decimalsOf(args)?.reduce(
        (product, item) => product.times(item),
        new FormDecimal(1),
      ) ?? null,
    "-": (...args) => {
      const [first, second] = decimalsOf(args) ?? [];
      if (!first) {
        return null;
      }
      return second ? first.minus(second) : first.negated();
    },
    "/": (...args) => divide(args, "div"),
    "%": (...args) => divide(args, "mod"),
    min: (...args) => {
      const decimals = decimalsOf(args);
      return decimals && decimals.length > 0
        ? FormDecimal.min(...decimals)
        : null;
    },
    max: (...args) => {
      const decimals = decimalsOf(args);
      return decimals && decimals.length > 0
        ? FormDecimal.max(...decimals)
        : null;
    },
    "<": (...args) => compareChain(args, (order) => order < 0),
    ">": (...args) => compareChain(args, (order) => order > 0),
    "<=": (...args) => compareChain(args, (order) => order <= 0),
    ">=": (...args) => compareChain(args, (order) => order >= 0),
    "==": (left, right) => looseEquals(left, right),
    "!=": (left, right) => !looseEquals(left, right),
    "===": (left, right) => strictEquals(left, right),
    "!==": (left, right) => !strictEquals(left, right),
    concat: (...args) => args.map((arg) => textOf(arg)).join(""),
    /** `{ "now": [] }` = `ctx.now`(歷史檢視時是那次修訂的時間,不是讀者的現在)。 */
    now() {
      return this.ctx.now;
    },
    /** `{ "dateDiff": [起, 迄] }` = 迄 − 起 的**日曆日**數(以 `ctx.timezone` 換算);任一無效 → null。 */
    dateDiff(start, end) {
      return calendarDayDiff(start, end, this.ctx.timezone);
    },
    /** `{ "optionLabel": "leave_type" }` = 該欄的顯示名(存的 label 或靜態選項定義的 label)。 */
    optionLabel(fieldKey) {
      const form = this[FORM_DATA_KEY];
      const field =
        typeof fieldKey === "string" ? form?.fields.get(fieldKey) : undefined;
      if (!form || !field) {
        return null;
      }
      return optionLabelOf(field, form.stored[field.key]);
    },
  };
  for (const [name, operation] of Object.entries(operations)) {
    jsonLogic.add_operation(name, operation);
  }
}

registerOperations();

export interface EvaluationInput {
  /** 語意值(`semanticValuesOf` 的結果;計算欄位算完的值也放這裡)。 */
  values: Record<string, unknown>;
  ctx: ExpressionContext;
  /** 給 `optionLabel` 用:欄位定義與**存的值**;不給時 `optionLabel` 一律回 null。 */
  fields?: readonly FieldDef[];
  stored?: StoredValues;
}

/** 形狀不合法就丟 `ExpressionError`(白名單、深度、節點、`var` 路徑)。 */
export function assertExpression(expr: Expression): void {
  const [issue] = scanExpression(expr).issues;
  if (issue) {
    throw new ExpressionError(
      `${issue.problem} at ${issue.path === "" ? "(root)" : issue.path}: ${issue.detail}`,
    );
  }
}

/** 內部用:回傳可能含 decimal 物件的原始結果(`computeField` 要在最後取位)。 */
export function evaluateRaw(expr: Expression, input: EvaluationInput): unknown {
  assertExpression(expr);
  // `ctx` 放最後:語意值裡就算混進同名鍵也蓋不掉上下文(`ctx` 是欄位保留字)
  const data: EvaluationData = { ...input.values, ctx: input.ctx };
  if (input.fields) {
    data[FORM_DATA_KEY] = {
      fields: new Map(input.fields.map((field) => [field.key, field])),
      stored: input.stored ?? {},
    };
  }
  return jsonLogic.apply(expr as jsonLogic.RulesLogic, data) as unknown;
}

/** 求值;數值結果回不取位的十進位字串。 */
export function evaluateExpression(
  expr: Expression,
  input: EvaluationInput,
): unknown {
  return unwrapDecimal(evaluateRaw(expr, input));
}

/** 條件表達式(`visibleWhen` / `readonlyWhen` / `rules.custom`)的真假值;JSONLogic 的 truthy 規則。 */
export function evaluateCondition(
  expr: Expression,
  input: EvaluationInput,
): boolean {
  return jsonLogic.truthy(evaluateRaw(expr, input));
}
