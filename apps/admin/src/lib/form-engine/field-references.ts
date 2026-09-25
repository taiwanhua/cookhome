import {
  type Expression,
  type ExpressionSlot,
  type FormDefinition,
  type SummarySlot,
  referencedFieldKeys,
} from "@repo/domain/form";

/**
 * 刪欄位前的確認清單(Spec 6a §8「設計器其他規則」):先列出**草稿內**引用它的表達式、摘要槽、帶入規則,
 * 以及**草稿外**的列表欄位配置(只提示,不動)。確認後只從 `fields[]` / `layout` 移除,這些引用處
 * 會變成檢查器錯誤(`EXPR_UNKNOWN_FIELD`、`SUMMARY_UNMAPPED`、`PREFILL_…`)由設計者手動修。
 */
export type FieldReference =
  | { kind: "expression"; fieldKey: string; slot: ExpressionSlot }
  | { kind: "summary"; slot: SummarySlot }
  | { kind: "prefill"; prefillIndex: number; label: string }
  | { kind: "listColumn" };

const EXPRESSION_SLOTS: readonly ExpressionSlot[] = [
  "valueSource.expr",
  "visibleWhen",
  "readonlyWhen",
  "rules.custom",
];

const expressionAt = (
  field: FormDefinition["fields"][number],
  slot: ExpressionSlot,
): Expression | undefined => {
  switch (slot) {
    case "valueSource.expr": {
      return field.valueSource.kind === "computed"
        ? field.valueSource.expr
        : undefined;
    }
    case "visibleWhen": {
      return field.visibleWhen;
    }
    case "readonlyWhen": {
      return field.readonlyWhen;
    }
    case "rules.custom": {
      return field.rules?.custom;
    }
  }
};

const refersTo = (expr: Expression | undefined, fieldKey: string): boolean => {
  if (expr === undefined || expr === null) {
    return false;
  }
  try {
    return referencedFieldKeys(expr).includes(fieldKey);
  } catch {
    return false;
  }
};

export const fieldReferences = (
  definition: FormDefinition,
  fieldKey: string,
  listColumnFieldKeys: readonly string[] = [],
): FieldReference[] => {
  const references: FieldReference[] = [];
  for (const field of definition.fields) {
    if (field.key === fieldKey) {
      continue;
    }
    for (const slot of EXPRESSION_SLOTS) {
      if (refersTo(expressionAt(field, slot), fieldKey)) {
        references.push({ kind: "expression", fieldKey: field.key, slot });
      }
    }
  }
  for (const slot of ["title", "date", "amount"] as const) {
    if (definition.summaryMap[slot] === fieldKey) {
      references.push({ kind: "summary", slot });
    }
  }
  for (const [prefillIndex, prefill] of definition.prefills.entries()) {
    if (prefill.mapping.some((entry) => entry.fieldKey === fieldKey)) {
      references.push({ kind: "prefill", prefillIndex, label: prefill.label });
    }
  }
  if (listColumnFieldKeys.includes(fieldKey)) {
    references.push({ kind: "listColumn" });
  }
  return references;
};

/**
 * 刪分區選「連同欄位刪除」前的確認清單:分區裡每個欄位被**分區外**引用的地方
 * (分區內欄位互相引用的不列 —— 它們一起刪掉)。同一處引用只列一次。
 */
export const sectionReferences = (
  definition: FormDefinition,
  fieldKeys: readonly string[],
  listColumnFieldKeys: readonly string[] = [],
): FieldReference[] => {
  const removed = new Set(fieldKeys);
  const seen = new Set<string>();
  return fieldKeys
    .flatMap((fieldKey) =>
      fieldReferences(definition, fieldKey, listColumnFieldKeys),
    )
    .filter(
      (reference) =>
        reference.kind !== "expression" || !removed.has(reference.fieldKey),
    )
    .filter((reference) => {
      const id = JSON.stringify(reference);
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
};
