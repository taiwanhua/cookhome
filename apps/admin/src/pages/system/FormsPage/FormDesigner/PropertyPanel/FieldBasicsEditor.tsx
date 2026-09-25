import { useTranslations } from "use-intl";

import { type FieldDef, LAYOUT_COLUMNS } from "@repo/domain/form";
import { SelectField } from "@repo/ui/select-field";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";

import { widgetKindsFor } from "@/components/form-engine/widgets/widget-registry";

export interface FieldBasicsEditorProps {
  field: FieldDef;
  span: number | null;
  onChange: (field: FieldDef) => void;
  onSpanChange: (span: number) => void;
}

const SPANS = Array.from(
  { length: LAYOUT_COLUMNS },
  (_item, index) => index + 1,
);
const PRECISIONS = [0, 1, 2, 3, 4, 5, 6];

/**
 * 欄位基本屬性:key(格式與保留字見檢查器;發布後改型別會報錯,改 key = 新欄位)、顯示名稱、
 * 元件(只列該型別可用的 widget)、寬度(12 格制)、小數位數(只有數字)、說明文字。
 */
export const FieldBasicsEditor = ({
  field,
  span,
  onChange,
  onSpanChange,
}: FieldBasicsEditorProps) => {
  const t = useTranslations("admin.forms.property");

  return (
    <Stack spacing={1.5}>
      <TextField
        label={t("key")}
        size="small"
        value={field.key}
        helperText={t("keyHint")}
        onChange={(event) => {
          onChange({ ...field, key: event.target.value.trim() });
        }}
      />
      <TextField
        label={t("label")}
        size="small"
        value={field.label}
        onChange={(event) => {
          onChange({ ...field, label: event.target.value });
        }}
      />
      <TextField
        label={t("type")}
        size="small"
        value={t(`types.${field.type}`)}
        disabled
      />
      <SelectField
        label={t("widget")}
        value={field.widget.kind}
        options={widgetKindsFor(field.type).map((kind) => ({
          value: kind,
          label: t(`widgets.${kind}`),
        }))}
        onChange={(kind) => {
          onChange({ ...field, widget: { ...field.widget, kind } });
        }}
        size="small"
      />
      {span !== null && (
        <SelectField
          label={t("span")}
          value={String(span)}
          options={SPANS.map((item) => ({
            value: String(item),
            label: String(item),
          }))}
          onChange={(next) => {
            onSpanChange(Number(next));
          }}
          size="small"
        />
      )}
      {field.type === "number" && (
        <SelectField
          label={t("precision")}
          value={String(field.precision ?? 0)}
          options={PRECISIONS.map((item) => ({
            value: String(item),
            label: String(item),
          }))}
          onChange={(next) => {
            onChange({ ...field, precision: Number(next) });
          }}
          size="small"
        />
      )}
      <TextField
        label={t("help")}
        size="small"
        value={field.help ?? ""}
        onChange={(event) => {
          onChange({
            ...field,
            help: event.target.value === "" ? null : event.target.value,
          });
        }}
      />
    </Stack>
  );
};
