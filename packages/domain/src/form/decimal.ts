import { Decimal } from "decimal.js";

/**
 * 表達式的數值運算(Spec §5「數值」):中間過程**不取位**,只有最後依欄位 `precision` 四捨五入;
 * 除以零與空值 → `null`。另收日期的日曆日換算與文字串接。
 */

/**
 * 中間計算用的 decimal:40 位有效數字、四捨五入、不用科學記號;
 * clone 出來的建構子,不改 decimal.js 的全域設定。
 */
export const FormDecimal = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -40,
  toExpPos: 40,
});

export type FormDecimalValue = InstanceType<typeof FormDecimal>;

const NUMERIC_STRING = /^-?\d+(?:\.\d+)?$/;

/** number、decimal 字串、decimal 物件 → decimal;其餘(含空值)→ null。 */
export function toDecimal(value: unknown): FormDecimalValue | null {
  if (value instanceof FormDecimal) {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? new FormDecimal(value) : null;
  }
  if (typeof value === "string" && NUMERIC_STRING.test(value)) {
    return new FormDecimal(value);
  }
  return null;
}

/** 任一參數不是數值(含空值)→ null,否則回 decimal 陣列。 */
export function decimalsOf(
  args: readonly unknown[],
): FormDecimalValue[] | null {
  const decimals: FormDecimalValue[] = [];
  for (const arg of args) {
    const decimal = toDecimal(arg);
    if (decimal === null) {
      return null;
    }
    decimals.push(decimal);
  }
  return decimals;
}

/** `a / b` 或 `a % b`:任一不是數值或除數為零 → null。 */
export function divide(
  args: readonly unknown[],
  operation: "div" | "mod",
): FormDecimalValue | null {
  const [dividend, divisor] = decimalsOf(args.slice(0, 2)) ?? [];
  if (!dividend || !divisor || divisor.isZero()) {
    return null;
  }
  return operation === "div"
    ? dividend.dividedBy(divisor)
    : dividend.modulo(divisor);
}

/** 回傳給呼叫端前把 decimal 轉成不取位的十進位字串(陣列逐元素)。 */
export function unwrapDecimal(value: unknown): unknown {
  if (value instanceof FormDecimal) {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => unwrapDecimal(item));
  }
  return value;
}

/** 文字化:空值 → 空字串、陣列以「、」串接、decimal 不取位。 */
export function textOf(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map((item) => textOf(item)).join("、");
  }
  if (value instanceof FormDecimal) {
    return value.toString();
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return typeof value === "object" ? JSON.stringify(value) : "";
}

/**
 * 兩個值的順序:兩邊都是數值就比數值,否則以**字碼**比文字(`YYYY-MM-DD` 的字碼序即日期序)。
 *
 * 不用 `localeCompare`:語系排序吃執行環境的 ICU 版本,前端即時算與後端重算可能不一致
 * (STRUCT-10 的同一個坑),而且和 JSONLogic 原生 `<` / `>` 的字碼序不同。
 */
function orderOf(left: unknown, right: unknown): number {
  const leftDecimal = toDecimal(left);
  const rightDecimal = toDecimal(right);
  if (leftDecimal && rightDecimal) {
    return leftDecimal.comparedTo(rightDecimal);
  }
  const leftText = textOf(left);
  const rightText = textOf(right);
  if (leftText === rightText) {
    return 0;
  }
  return leftText < rightText ? -1 : 1;
}

/** `<` / `<=` 等比較(支援 JSONLogic 的三參數「介於」);有空值 → false。 */
export function compareChain(
  args: readonly unknown[],
  test: (order: number) => boolean,
): boolean {
  if (
    args.length < 2 ||
    args.some((arg) => arg === null || arg === undefined)
  ) {
    return false;
  }
  let previous: unknown = args[0];
  for (const current of args.slice(1)) {
    if (!test(orderOf(previous, current))) {
      return false;
    }
    previous = current;
  }
  return true;
}

/** `==`:兩邊都是數值比數值(`"1.50" == 1.5`),否則 JSONLogic 的寬鬆相等。 */
export function looseEquals(left: unknown, right: unknown): boolean {
  const leftDecimal = toDecimal(left);
  const rightDecimal = toDecimal(right);
  if (leftDecimal && rightDecimal) {
    return leftDecimal.equals(rightDecimal);
  }
  return unwrapDecimal(left) == unwrapDecimal(right);
}

/** `===`:decimal 物件與數值比數值且型別相同,其餘嚴格相等。 */
export function strictEquals(left: unknown, right: unknown): boolean {
  if (left instanceof FormDecimal || right instanceof FormDecimal) {
    return (
      looseEquals(left, right) &&
      typeof unwrapDecimal(left) === typeof unwrapDecimal(right)
    );
  }
  return left === right;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** 某時點在該時區的日曆日(`YYYY-MM-DD`);`YYYY-MM-DD` 本身視為已是日曆日;無效 → null。 */
export function calendarDateOf(
  value: unknown,
  timezone: string,
): string | null {
  if (typeof value === "string" && DATE_ONLY.test(value)) {
    return value;
  }
  if (typeof value !== "string" && !(value instanceof Date)) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const part = (type: string) =>
      parts.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch {
    // 時區字串不合法
    return null;
  }
}

/** 迄 − 起 的日曆日數(以該時區換算);任一無效 → null。 */
export function calendarDayDiff(
  start: unknown,
  end: unknown,
  timezone: string,
): FormDecimalValue | null {
  const from = calendarDateOf(start, timezone);
  const to = calendarDateOf(end, timezone);
  if (from === null || to === null) {
    return null;
  }
  return new FormDecimal(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      MS_PER_DAY,
  );
}

/** 最終取位:數值四捨五入到 `precision` 位的十進位字串;不是數值 → null。 */
export function roundToPrecision(
  value: unknown,
  precision: number,
): string | null {
  const decimal = toDecimal(value);
  return decimal === null
    ? null
    : decimal.toFixed(precision, FormDecimal.ROUND_HALF_UP);
}
