import { DatePicker } from "@repo/ui/date-picker";

import { scalarText } from "@/lib/form-engine/value-text";

import type { WidgetProps } from "./widget-types";

/** 日期欄(`date` → `datePicker`):收發 `YYYY-MM-DD`,與存值形狀相同。 */
export const DateWidget = ({
  field,
  value,
  onChange,
  isDisabled,
  helperText,
  hasError,
}: WidgetProps) => {
  const text = scalarText(value);

  return (
    <DatePicker
      label={field.label}
      value={text === "" ? null : text}
      onChange={(next) => {
        onChange(next);
      }}
      disabled={isDisabled}
      required={field.rules?.required === true}
      error={hasError}
      helperText={helperText}
      fullWidth
      size="small"
    />
  );
};
