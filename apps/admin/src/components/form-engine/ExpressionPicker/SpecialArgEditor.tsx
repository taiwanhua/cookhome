import { useTranslations } from "use-intl";

import {
  DATE_DIFF_UNITS,
  DEFAULT_DATE_DIFF_UNIT,
  type DateDiffUnit,
  type Expression,
  type FieldDef,
} from "@repo/domain/form";
import { SelectField } from "@repo/ui/select-field";

export interface SpecialArgEditorProps {
  /** `dateUnit` = `dateDiff` 的單位;`optionField` = `optionLabel` 要取顯示名的選項欄位 */
  kind: "dateUnit" | "optionField";
  value: Expression | undefined;
  onChange: (value: Expression) => void;
  fields: readonly FieldDef[];
}

const isDateDiffUnit = (value: unknown): value is DateDiffUnit =>
  typeof value === "string" &&
  (DATE_DIFF_UNITS as readonly string[]).includes(value);

/**
 * 不是一般值的參數位置(Spec 6a §5 表 B):`dateDiff` 的單位下拉(天 / 小時 / 分鐘,缺參數視為天)、
 * `optionLabel` 的選項欄位下拉(只列單選 / 多選欄,存欄位 key 字串)。
 */
export const SpecialArgEditor = ({
  kind,
  value,
  onChange,
  fields,
}: SpecialArgEditorProps) => {
  const t = useTranslations("admin.forms.expression");

  if (kind === "dateUnit") {
    return (
      <SelectField<DateDiffUnit>
        label={t("unit")}
        value={isDateDiffUnit(value) ? value : DEFAULT_DATE_DIFF_UNIT}
        options={DATE_DIFF_UNITS.map((unit) => ({
          value: unit,
          label: t(`units.${unit}`),
        }))}
        onChange={onChange}
        size="small"
        sx={{ minWidth: 120 }}
      />
    );
  }
  const choices = fields.filter(
    (field) => field.type === "select" || field.type === "multiSelect",
  );
  return (
    <SelectField
      label={t("optionField")}
      value={typeof value === "string" ? value : ""}
      displayEmpty
      options={[
        { value: "", label: t("optionFieldUnset") },
        ...choices.map((field) => ({
          value: field.key,
          label: `${field.label}(${field.key})`,
        })),
      ]}
      onChange={(fieldKey) => {
        onChange(fieldKey === "" ? null : fieldKey);
      }}
      size="small"
      sx={{ minWidth: 160 }}
    />
  );
};
