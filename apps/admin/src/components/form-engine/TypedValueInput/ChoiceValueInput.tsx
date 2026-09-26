import { createElement } from "react";

import type { FieldDef, FieldType } from "@repo/domain/form";
import { SelectField } from "@repo/ui/select-field";

import { identityOf } from "@/lib/form-engine/value-text";

import { widgetOf } from "../widgets/widget-registry";
import type { TypedValueField, TypedValueShape } from "./typed-value";

export interface ChoiceValueInputProps {
  field: TypedValueField;
  value: unknown;
  onChange: (value: unknown) => void;
  label: string;
  shape: TypedValueShape;
  isMultiple: boolean;
  formKey: string;
  emptyLabel?: string;
  helperText?: string;
  timezone: string;
}

const NONE = "";

/** 選項欄照「單選 / 多選」挑:型別與元件跟著換(填寫時的 `ChoiceWidget` / `MultiChoiceWidget`)。 */
const choiceFieldOf = (
  field: TypedValueField,
  isMultiple: boolean,
): TypedValueField => {
  const type: FieldType = isMultiple ? "multiSelect" : "select";
  return type === field.type
    ? field
    : {
        ...field,
        type,
        widget: { kind: isMultiple ? "multiDropdown" : "dropdown" },
      };
};

const stringsOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const isEmptyChoice = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

/** 選擇器回的存值 → 要回報的值:表達式常數只留 value(多選 = value 陣列);空 → null。 */
const reportedOf = (next: unknown, shape: TypedValueShape): unknown => {
  if (isEmptyChoice(next)) {
    return null;
  }
  if (shape === "stored") {
    return next;
  }
  return Array.isArray(next)
    ? next.map((item) => identityOf(item))
    : identityOf(next);
};

/**
 * 從選項欄的選項挑值(`TypedValueInput` 的單選 / 多選分支):靜態選項直接下拉(存 value);
 * 類別 / lookup 用填寫時的選擇器挑(存值 `{ value, label }`,表達式常數只留 value)。
 */
export const ChoiceValueInput = ({
  field,
  value,
  onChange,
  label,
  shape,
  isMultiple,
  formKey,
  emptyLabel,
  helperText,
  timezone,
}: ChoiceValueInputProps) => {
  const common = {
    label,
    size: "small" as const,
    ...(helperText !== undefined && { helperText }),
  };
  if (field.options?.kind === "static") {
    const items = field.options.items
      .filter((item) => item.enabled)
      .map((item) => ({ value: item.value, label: item.label }));
    if (isMultiple) {
      return (
        <SelectField<string>
          {...common}
          multiple
          value={stringsOf(value)}
          options={items}
          onChange={(picked) => {
            onChange(picked.length === 0 ? null : picked);
          }}
        />
      );
    }
    return (
      <SelectField<string>
        {...common}
        value={typeof value === "string" ? value : NONE}
        displayEmpty={emptyLabel !== undefined}
        options={[
          ...(emptyLabel === undefined
            ? []
            : [{ value: NONE, label: emptyLabel }]),
          ...items,
        ]}
        onChange={(next) => {
          onChange(next === NONE ? null : next);
        }}
      />
    );
  }
  const choice = choiceFieldOf(field, isMultiple);
  return createElement(widgetOf(choice.widget.kind), {
    field: { ...(choice as FieldDef), label },
    value: value ?? null,
    onChange: (next: unknown) => {
      onChange(reportedOf(next, shape));
    },
    isDisabled: false,
    isDesign: false,
    ...(helperText !== undefined && { helperText }),
    hasError: false,
    context: { formKey, version: null, timezone },
  });
};
