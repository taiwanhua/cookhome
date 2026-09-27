import { scanExpression } from "./expression-shape";
import {
  type ExpectedTypes,
  type ExpressionValueType,
  FIELD_EXPRESSION_TYPES,
  type FieldTypeLookup,
  OPERATOR_SIGNATURES,
  type OperatorSignature,
  constantTypeOf,
  expectedTypesAt,
  fieldTypeLookupOf,
  inferExpressionType,
  isDateDiffUnit,
  isTypeAccepted,
  paramSpecAt,
} from "./expression-types";
import type { ExpressionSlot, IssueCollector } from "./issues";
import type { Expression, FieldDef } from "./types";
import { expressionsOf } from "./validate-expressions";

/**
 * 檢查器的**型別**段(Spec 6a §5「表達式選擇器:型別導向(表 B)」;與設計器的選擇器同一張表
 * `expression-types.ts`,設計器過濾後兩邊不會打架):
 *
 * - 根節點:計算欄位公式 / 預設值公式 = 欄位型別;顯示條件 / 鎖定條件 / 自訂驗證 = 是 / 否
 * - 每個運算子的每個參數位置型別相符(`sameAs` / `if` 的然後 / 否則同型別照表推)
 * - `dateDiff` 的單位只能是 `days` / `hours` / `minutes`(不給 = `days`)
 * - `optionLabel` 只能指選項欄(單選 / 多選)或引用欄
 *
 * 推不出型別的節點(`null` 常數、未知欄位、上傳欄以外的空值)不報;形狀有問題的表達式由形狀段報,
 * 這裡整個跳過(避免同一個錯誤報兩次)。日期與日期時間互通(`isTypeAccepted`),比較運算子兩邊除外。
 */

const TYPE_LABELS: Readonly<Record<ExpressionValueType, string>> = {
  text: "文字",
  number: "數字",
  boolean: "是 / 否",
  date: "日期",
  datetime: "日期時間",
  list: "清單",
};

const SLOT_LABELS: Readonly<Record<ExpressionSlot, string>> = {
  "valueSource.expr": "公式",
  "default.expr": "預設值公式",
  visibleWhen: "顯示條件",
  readonlyWhen: "鎖定條件",
  "rules.custom": "自訂驗證",
};

const OPTION_LABEL_TYPES = new Set(["select", "multiSelect", "reference"]);

interface TypeCheckContext {
  field: FieldDef;
  slot: ExpressionSlot;
  typeOf: FieldTypeLookup;
  fieldsByKey: ReadonlyMap<string, FieldDef>;
  collector: IssueCollector;
}

const isOperationNode = (
  expr: Expression,
): expr is Record<string, Expression> =>
  typeof expr === "object" && expr !== null && !Array.isArray(expr);

const joinPath = (base: string, segment: string | number): string =>
  base === "" ? String(segment) : `${base}.${String(segment)}`;

function describe(expected: ExpectedTypes): string {
  return expected === null
    ? "任何型別"
    : expected.map((type) => TYPE_LABELS[type]).join(" / ");
}

/** 公式類槽的根要的型別(欄位型別);上傳欄不進表達式 → 不檢查(回 undefined)。 */
function rootExpectedOf(
  field: FieldDef,
  slot: ExpressionSlot,
): ExpectedTypes | undefined {
  if (slot === "valueSource.expr" || slot === "default.expr") {
    const type = FIELD_EXPRESSION_TYPES[field.type] as
      ExpressionValueType | null | undefined;
    return type ? [type] : undefined;
  }
  return ["boolean"];
}

export function validateExpressionTypes(
  fields: readonly FieldDef[],
  collector: IssueCollector,
): void {
  const typeOf = fieldTypeLookupOf(fields);
  const fieldsByKey = new Map(fields.map((field) => [field.key, field]));
  for (const field of fields) {
    for (const { slot, expr } of expressionsOf(field)) {
      const expected = rootExpectedOf(field, slot);
      if (expected === undefined || scanExpression(expr).issues.length > 0) {
        continue;
      }
      checkNode(
        { field, slot, typeOf, fieldsByKey, collector },
        expr,
        expected,
        "",
      );
    }
  }
}

function mismatch(
  context: TypeCheckContext,
  path: string,
  expected: ExpectedTypes,
  actual: string,
): void {
  const { field, slot } = context;
  context.collector.error(
    "EXPR_TYPE_MISMATCH",
    `「${field.label}」的${SLOT_LABELS[slot]}在這個位置需要${describe(expected)},拿到的是${actual}`,
    { fieldKey: field.key, exprSlot: slot, exprPath: path },
  );
}

function checkNode(
  context: TypeCheckContext,
  expr: Expression,
  expected: ExpectedTypes,
  path: string,
): void {
  if (!isOperationNode(expr)) {
    const type = constantTypeOf(expr);
    if (type !== null && !isTypeAccepted(type, expected)) {
      mismatch(context, path, expected, TYPE_LABELS[type]);
    }
    return;
  }
  const [operator] = Object.keys(expr);
  if (operator === undefined) {
    return;
  }
  const operatorPath = joinPath(path, operator);
  if (operator === "var") {
    checkVar(context, expr, expected, operatorPath);
    return;
  }
  const signature = (
    OPERATOR_SIGNATURES as Readonly<Partial<Record<string, OperatorSignature>>>
  )[operator];
  if (signature === undefined) {
    return;
  }
  if (
    signature.returns !== "then" &&
    !isTypeAccepted(signature.returns, expected)
  ) {
    mismatch(context, operatorPath, expected, TYPE_LABELS[signature.returns]);
    return;
  }
  checkArguments(
    context,
    operator as keyof typeof OPERATOR_SIGNATURES,
    expr[operator] ?? null,
    expected,
    operatorPath,
  );
}

/** 運算節點的每個參數,依它的位置要的型別往下檢查。 */
function checkArguments(
  context: TypeCheckContext,
  knownOperator: keyof typeof OPERATOR_SIGNATURES,
  raw: Expression,
  expected: ExpectedTypes,
  operatorPath: string,
): void {
  const isArgumentList = Array.isArray(raw);
  const args: Expression[] = isArgumentList ? raw : [raw];
  for (const [index, argument] of args.entries()) {
    const argumentPath = isArgumentList
      ? joinPath(operatorPath, index)
      : operatorPath;
    const spec = paramSpecAt(knownOperator, index);
    if (spec === null) {
      continue;
    }
    if (spec.kind === "dateUnit") {
      if (!isDateDiffUnit(argument)) {
        context.collector.error(
          "EXPR_DATE_DIFF_UNIT",
          `「${context.field.label}」的${SLOT_LABELS[context.slot]}:日期差的單位只能是天 / 小時 / 分鐘`,
          {
            fieldKey: context.field.key,
            exprSlot: context.slot,
            exprPath: argumentPath,
          },
        );
      }
      continue;
    }
    if (spec.kind === "optionField") {
      checkOptionField(context, argument, argumentPath);
      continue;
    }
    checkNode(
      context,
      argument,
      expectedTypesAt(knownOperator, index, args, expected, context.typeOf),
      argumentPath,
    );
  }
}

function checkVar(
  context: TypeCheckContext,
  expr: Record<string, Expression>,
  expected: ExpectedTypes,
  path: string,
): void {
  const type = inferExpressionType(expr, context.typeOf);
  if (type !== null) {
    if (!isTypeAccepted(type, expected)) {
      mismatch(context, path, expected, TYPE_LABELS[type]);
    }
    return;
  }
  // 推不出型別:只有「引用了上傳欄」要報(上傳欄不可進表達式);不存在的欄位由引用檢查報
  const argument = expr.var;
  const target = Array.isArray(argument) ? argument[0] : argument;
  const referenced =
    typeof target === "string" ? context.fieldsByKey.get(target) : undefined;
  if (referenced?.type === "upload") {
    mismatch(context, path, expected, "上傳欄位(不可放進表達式)");
  }
}

function checkOptionField(
  context: TypeCheckContext,
  argument: Expression,
  path: string,
): void {
  const target = Array.isArray(argument) ? argument[0] : argument;
  const referenced =
    typeof target === "string" ? context.fieldsByKey.get(target) : undefined;
  if (referenced && !OPTION_LABEL_TYPES.has(referenced.type)) {
    context.collector.error(
      "EXPR_TYPE_MISMATCH",
      `「${context.field.label}」的${SLOT_LABELS[context.slot]}:取選項名稱只能指單選 / 多選 / 引用欄位`,
      { fieldKey: context.field.key, exprSlot: context.slot, exprPath: path },
    );
  }
}
