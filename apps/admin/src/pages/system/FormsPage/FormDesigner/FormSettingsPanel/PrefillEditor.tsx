import { useTranslations } from "use-intl";

import type { FieldDef, Prefill } from "@repo/domain/form";
import { Button } from "@repo/ui/button";
import { SelectField } from "@repo/ui/select-field";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";

import { LookupSourceEditor } from "../PropertyPanel/LookupSourceEditor";

export interface PrefillEditorProps {
  prefill: Prefill;
  index: number;
  fields: readonly FieldDef[];
  onChange: (prefill: Prefill) => void;
  onRemove: () => void;
}

/**
 * 一條帶入規則(Spec 6a §5「帶入」):顯示名、來源、對應表(來源欄位 → 本表單欄位)。
 * 目標只能是「使用者填」的欄位(不能帶進計算 / 固定值 / 引用);型別相容與來源欄位存在由檢查器驗。
 */
export const PrefillEditor = ({
  prefill,
  index,
  fields,
  onChange,
  onRemove,
}: PrefillEditorProps) => {
  const t = useTranslations("admin.forms.prefill");
  const targets = fields.filter(
    (field) => field.valueSource.kind === "input" && field.type !== "reference",
  );

  return (
    <Stack
      spacing={1.5}
      role="group"
      aria-label={t("rule", { index: index + 1 })}
    >
      <TextField
        label={t("label")}
        size="small"
        value={prefill.label}
        onChange={(event) => {
          onChange({ ...prefill, label: event.target.value });
        }}
      />
      <LookupSourceEditor
        value={prefill.source}
        hasValueField={false}
        onChange={(source) => {
          onChange({ ...prefill, source });
        }}
      />
      {prefill.mapping.map((entry, position) => (
        <Stack
          key={`${String(position)}-${entry.fieldKey}`}
          direction="row"
          spacing={1}
          sx={{ alignItems: "center" }}
        >
          <TextField
            label={t("sourceField")}
            size="small"
            value={entry.sourceField}
            onChange={(event) => {
              onChange({
                ...prefill,
                mapping: prefill.mapping.map((item, at) =>
                  at === position
                    ? { ...item, sourceField: event.target.value }
                    : item,
                ),
              });
            }}
          />
          <SelectField
            label={t("targetField")}
            value={entry.fieldKey}
            options={targets.map((field) => ({
              value: field.key,
              label: `${field.label}(${field.key})`,
            }))}
            onChange={(fieldKey) => {
              onChange({
                ...prefill,
                mapping: prefill.mapping.map((item, at) =>
                  at === position ? { ...item, fieldKey } : item,
                ),
              });
            }}
            size="small"
            sx={{ minWidth: 160 }}
          />
          <Button
            variant="text"
            size="small"
            onClick={() => {
              onChange({
                ...prefill,
                mapping: prefill.mapping.filter((_item, at) => at !== position),
              });
            }}
          >
            {t("removeMapping")}
          </Button>
        </Stack>
      ))}
      <Stack direction="row" spacing={1}>
        <Button
          variant="text"
          size="small"
          disabled={targets.length === 0}
          onClick={() => {
            onChange({
              ...prefill,
              mapping: [
                ...prefill.mapping,
                { sourceField: "", fieldKey: targets.at(0)?.key ?? "" },
              ],
            });
          }}
        >
          {t("addMapping")}
        </Button>
        <Button variant="text" size="small" color="error" onClick={onRemove}>
          {t("remove")}
        </Button>
      </Stack>
    </Stack>
  );
};
