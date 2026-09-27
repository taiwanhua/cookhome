import {
  CONTEXT_VAR_PATHS,
  CONTEXT_VAR_TYPES,
  type ExpectedTypes,
  type Expression,
  type ExpressionValueType,
  FIELD_EXPRESSION_TYPES,
  type FieldDef,
  fieldProtections,
  isOperatorAccepted,
  isProtected,
  isTypeAccepted,
} from "@repo/domain/form";

import {
  CONSTANT_KINDS,
  type ConstantKind,
  type ExpressionNodeKind,
  PICKER_OPERATORS,
  type PickerOperator,
  operationNode,
} from "./expression-tree";

/**
 * 表達式選擇器的**型別導向過濾**(Spec 6a §5「表達式選擇器:型別導向(表 B)」):每個位置帶「期望型別」,
 * 只列型別對得上的欄位 / 系統值 / 常數 / 運算。型別表的正本在 `@repo/domain/form` 的 `expression-types.ts`
 * (檢查器與這裡共用同一張)。
 *
 * - 公式(計算欄位、預設值):根要回**欄位的型別**;系統值只列現在時間(日期 / 日期時間位置)、
 *   填寫者 / 填寫者的組織(文字位置)
 * - 條件(顯示條件、鎖定條件、自訂驗證、流程跳過條件):根要回**是 / 否**;常數不能單獨當根、
 *   系統值單獨當根也不行;四個系統值在型別對得上的裡層位置都可用
 */
export type PickerUsage = "formula" | "condition";

export type ContextPath = (typeof CONTEXT_VAR_PATHS)[number];

export interface PickerPosition {
  expected: ExpectedTypes;
  usage: PickerUsage;
  isRoot: boolean;
  /** 比較(等於 / 不等於)的參數可以放空值常數(`== null` 判空) */
  allowNull: boolean;
}

export interface PositionOptions {
  kinds: ExpressionNodeKind[];
  fields: FieldDef[];
  contexts: ContextPath[];
  constants: ConstantKind[];
  operators: PickerOperator[];
}

/** 公式能用的系統值(Spec 表 B「系統值可選」:時區只在條件裡用)。 */
const FORMULA_CONTEXTS = new Set<ContextPath>([
  "ctx.now",
  "ctx.user.id",
  "ctx.user.orgId",
]);

const CONSTANT_TYPES: Readonly<
  Record<Exclude<ConstantKind, "null">, ExpressionValueType>
> = {
  text: "text",
  number: "number",
  boolean: "boolean",
  date: "date",
  list: "list",
};

/** 比較運算子:參數可以是空值常數。 */
export const EQUALITY_OPERATORS: readonly string[] = ["==", "!=", "===", "!=="];

export const fieldExpressionType = (
  field: FieldDef,
): ExpressionValueType | null => FIELD_EXPRESSION_TYPES[field.type];

export const positionOptionsOf = (
  position: PickerPosition,
  fields: readonly FieldDef[],
): PositionOptions => {
  const { expected, usage, isRoot } = position;
  const isConditionRoot = isRoot && usage === "condition";
  const matchingFields = fields.filter((field) => {
    const type = fieldExpressionType(field);
    return type !== null && isTypeAccepted(type, expected);
  });
  const contexts = isConditionRoot
    ? []
    : CONTEXT_VAR_PATHS.filter(
        (path) =>
          (usage === "condition" || FORMULA_CONTEXTS.has(path)) &&
          isTypeAccepted(CONTEXT_VAR_TYPES[path], expected),
      );
  const constants = isConditionRoot
    ? []
    : CONSTANT_KINDS.filter((kind) =>
        kind === "null"
          ? position.allowNull
          : isTypeAccepted(CONSTANT_TYPES[kind], expected),
      );
  const operators = PICKER_OPERATORS.filter((operator) =>
    isOperatorAccepted(operator, expected),
  );
  const kinds: ExpressionNodeKind[] = [];
  if (matchingFields.length > 0) {
    kinds.push("field");
  }
  if (contexts.length > 0) {
    kinds.push("context");
  }
  if (constants.length > 0) {
    kinds.push("constant");
  }
  if (operators.length > 0) {
    kinds.push("operation");
  }
  return {
    kinds,
    fields: matchingFields,
    contexts,
    constants,
    operators,
  };
};

/** 「設定」時的起點:第一個型別對得上的偏好運算(數字 → 乘、文字 → 串接、是 / 否 → 等於,其餘 → 如果)。 */
const INITIAL_PREFERENCE: readonly PickerOperator[] = [
  "*",
  "concat",
  "==",
  "if",
];

export const initialExpressionOf = (expected: ExpectedTypes): Expression =>
  operationNode(
    INITIAL_PREFERENCE.find((operator) =>
      isOperatorAccepted(operator, expected),
    ) ?? "if",
  );

/**
 * 條件可引用的欄位:**不含受保護欄位**(含因引用受保護欄位而受保護的計算欄位;v1 禁止條件引用它們)、
 * 上傳欄不能進表達式;`includeSelf` 決定列不列自己(顯示條件不可引用自己)。
 */
export const conditionFieldsOf = (
  fields: readonly FieldDef[],
  selfKey: string | null,
  includeSelf: boolean,
): FieldDef[] => {
  const protections = fieldProtections(fields);
  return fields.filter(
    (field) =>
      (includeSelf || field.key !== selfKey) &&
      !isProtected(protections.get(field.key)),
  );
};
