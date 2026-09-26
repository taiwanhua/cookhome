import { useTranslations } from "use-intl";

import {
  ALLOW_CUSTOM_WIDGETS,
  type FieldDef,
  type FieldRules,
  TEXT_FORMATS,
  type TextFormat,
} from "@repo/domain/form";
import { FormControlLabel } from "@repo/ui/form-control-label";
import { SelectField } from "@repo/ui/select-field";
import { Stack } from "@repo/ui/stack";
import { Switch } from "@repo/ui/switch";
import { TextField } from "@repo/ui/text-field";

import { ExpressionPicker } from "@/components/form-engine/ExpressionPicker/ExpressionPicker";
import { scalarText } from "@/lib/form-engine/value-text";

export interface RulesEditorProps {
  field: FieldDef;
  fields: readonly FieldDef[];
  onChange: (rules: FieldRules) => void;
  customIssues: readonly string[];
}

const NO_FORMAT = "";

/** 空字串 = 移除這條規則(不存 `""` 進定義)。 */
const withRule = <Key extends keyof FieldRules>(
  rules: FieldRules,
  key: Key,
  value: FieldRules[Key] | "",
): FieldRules => {
  const next: FieldRules = { ...rules };
  if (value === "" || value === undefined) {
    Reflect.deleteProperty(next, key);
  } else {
    next[key] = value;
  }
  return next;
};

const numberOrEmpty = (text: string): number | "" =>
  text.trim() === "" ? "" : Number(text);

/**
 * 驗證規則(Spec 6a §5 `rules`):必填、範圍(number / date)、長度與正則 / 內建格式(text)、
 * `allowCustom`(只有 autocomplete 類 widget)、自訂驗證(表達式,回 false 即錯)。
 * 正則要搭錯誤訊息、與內建格式二擇一、不安全的正則由檢查器指出(`PATTERN_*`)。
 */
export const RulesEditor = ({
  field,
  fields,
  onChange,
  customIssues,
}: RulesEditorProps) => {
  const t = useTranslations("admin.forms.rules");
  const rules = field.rules ?? {};
  const isText = field.type === "text" || field.type === "multiline";
  const hasRange = field.type === "number" || field.type === "date";

  return (
    <Stack spacing={1.5}>
      <FormControlLabel
        label={t("required")}
        control={
          <Switch
            checked={rules.required === true}
            onChange={(_event, checked) => {
              onChange({ ...rules, required: checked });
            }}
          />
        }
      />
      {hasRange && (
        <Stack direction="row" spacing={1}>
          <TextField
            label={t("min")}
            size="small"
            value={scalarText(rules.min)}
            onChange={(event) => {
              onChange(withRule(rules, "min", event.target.value.trim()));
            }}
          />
          <TextField
            label={t("max")}
            size="small"
            value={scalarText(rules.max)}
            onChange={(event) => {
              onChange(withRule(rules, "max", event.target.value.trim()));
            }}
          />
        </Stack>
      )}
      {isText && (
        <>
          <Stack direction="row" spacing={1}>
            <TextField
              label={t("minLength")}
              size="small"
              type="number"
              value={scalarText(rules.minLength)}
              onChange={(event) => {
                onChange(
                  withRule(
                    rules,
                    "minLength",
                    numberOrEmpty(event.target.value),
                  ),
                );
              }}
            />
            <TextField
              label={t("maxLength")}
              size="small"
              type="number"
              value={scalarText(rules.maxLength)}
              onChange={(event) => {
                onChange(
                  withRule(
                    rules,
                    "maxLength",
                    numberOrEmpty(event.target.value),
                  ),
                );
              }}
            />
          </Stack>
          <SelectField<TextFormat | typeof NO_FORMAT>
            label={t("format")}
            value={rules.format ?? NO_FORMAT}
            displayEmpty
            options={[
              { value: NO_FORMAT, label: t("formatNone") },
              ...TEXT_FORMATS.map((format) => ({
                value: format,
                label: t(`formats.${format}`),
              })),
            ]}
            onChange={(format) => {
              onChange(withRule(rules, "format", format));
            }}
            size="small"
          />
          <TextField
            label={t("pattern")}
            size="small"
            value={rules.pattern ?? ""}
            helperText={t("patternHint")}
            onChange={(event) => {
              onChange(withRule(rules, "pattern", event.target.value));
            }}
          />
          <TextField
            label={t("patternMessage")}
            size="small"
            value={rules.patternMessage ?? ""}
            onChange={(event) => {
              onChange(withRule(rules, "patternMessage", event.target.value));
            }}
          />
        </>
      )}
      {ALLOW_CUSTOM_WIDGETS.includes(field.widget.kind) && (
        <FormControlLabel
          label={t("allowCustom")}
          control={
            <Switch
              checked={rules.allowCustom === true}
              onChange={(_event, checked) => {
                onChange({ ...rules, allowCustom: checked });
              }}
            />
          }
        />
      )}
      <ExpressionPicker
        label={t("custom")}
        value={rules.custom}
        fields={fields}
        issues={customIssues}
        onChange={(custom) => {
          onChange(
            custom === null
              ? withRule(rules, "custom", "")
              : { ...rules, custom },
          );
        }}
      />
    </Stack>
  );
};
