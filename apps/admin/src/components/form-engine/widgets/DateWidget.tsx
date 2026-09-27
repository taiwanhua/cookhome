import { DEFAULT_TENANT_TIMEZONE } from "@repo/domain/form";
import { DatePicker } from "@repo/ui/date-picker";

import { localDayInstantOf, localDayTextOf } from "@/lib/form-engine/local-day";

import type { WidgetProps } from "./widget-types";

/**
 * 日期欄(`date` → `datePicker`,Spec 6a §5「值的存法」):存的是**時點** —— 選的那一天在租戶時區 00:00。
 * 選日 → `startOfLocalDay`(租戶時區)→ ISO 送出;顯示 → 時點換成租戶時區的 `YYYY-MM-DD` 給選擇器。
 * 時區 = `context.timezone`(填寫端 `me.currentOrg.timezone`、唯讀檢視是那次修訂的時區),沒給用預設時區。
 */
export const DateWidget = ({
  field,
  value,
  onChange,
  isDisabled,
  helperText,
  hasError,
  context,
}: WidgetProps) => {
  const timezone = context.timezone ?? DEFAULT_TENANT_TIMEZONE;

  return (
    <DatePicker
      label={field.label}
      value={localDayTextOf(value, timezone)}
      onChange={(next) => {
        onChange(localDayInstantOf(next, timezone));
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
