import { TextField } from "@repo/ui/text-field";

import { scalarText } from "@/lib/form-engine/value-text";

import type { WidgetProps } from "./widget-types";

const DEFAULT_ROWS = 3;

/**
 * 文字欄(`text` → `textField`、`multiline` → `textArea`)。
 * widget 只管長相(`placeholder`、`rows`),長度 / 正則 / 格式驗證在 api(與 `@repo/domain/form` 的 `values.ts`)。
 */
export const TextWidget = ({
  field,
  value,
  onChange,
  isDisabled,
  helperText,
  hasError,
}: WidgetProps) => {
  const isMultiline = field.type === "multiline";
  const rows =
    typeof field.widget.rows === "number" ? field.widget.rows : DEFAULT_ROWS;
  const placeholder = scalarText(field.widget.placeholder);

  return (
    <TextField
      label={field.label}
      value={scalarText(value)}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      disabled={isDisabled}
      required={field.rules?.required === true}
      error={hasError}
      helperText={helperText}
      fullWidth
      size="small"
      {...(placeholder !== "" && { placeholder })}
      {...(isMultiline && { multiline: true, minRows: rows })}
    />
  );
};
