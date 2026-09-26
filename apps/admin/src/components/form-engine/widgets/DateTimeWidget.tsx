import { normalizeDateTime } from "@repo/domain/form";
import { DateTimePicker } from "@repo/ui/date-time-picker";

import { scalarText } from "@/lib/form-engine/value-text";

import type { WidgetProps } from "./widget-types";

/** `rules.min` / `max` 收任何時區的 ISO 8601;給選擇器前先收成 UTC,不合法就不限。 */
const limitOf = (raw: unknown): string | undefined =>
  normalizeDateTime(raw) ?? undefined;

/**
 * 日期時間欄(`datetime` → `dateTimePicker`,Spec 6a §5):存 ISO 8601 UTC(`YYYY-MM-DDTHH:mm:ssZ`),
 * 以**租戶時區**輸入與顯示(`context.timezone`,填寫端取自 `me.currentOrg.timezone`;唯讀檢視用那次修訂的時區)。
 */
export const DateTimeWidget = ({
  field,
  value,
  onChange,
  isDisabled,
  helperText,
  hasError,
  context,
}: WidgetProps) => {
  const text = scalarText(value);
  const min = limitOf(field.rules?.min);
  const max = limitOf(field.rules?.max);

  return (
    <DateTimePicker
      label={field.label}
      value={text === "" ? null : text}
      onChange={(next) => {
        onChange(next);
      }}
      {...(context.timezone !== undefined && { timezone: context.timezone })}
      {...(min !== undefined && { minDateTime: min })}
      {...(max !== undefined && { maxDateTime: max })}
      disabled={isDisabled}
      required={field.rules?.required === true}
      error={hasError}
      helperText={helperText}
      fullWidth
      size="small"
    />
  );
};
