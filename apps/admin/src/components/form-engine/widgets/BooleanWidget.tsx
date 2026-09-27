import { Checkbox } from "@repo/ui/checkbox";
import { FormControlLabel } from "@repo/ui/form-control-label";
import { Stack } from "@repo/ui/stack";
import { Switch } from "@repo/ui/switch";
import { Typography } from "@repo/ui/typography";

import type { WidgetProps } from "./widget-types";

/** 是否欄(`boolean` → `switch` / `checkbox`)。 */
export const BooleanWidget = ({
  field,
  value,
  onChange,
  isDisabled,
  helperText,
  hasError,
}: WidgetProps) => {
  const control =
    field.widget.kind === "checkbox" ? (
      <Checkbox
        checked={value === true}
        disabled={isDisabled}
        onChange={(_event, checked) => {
          onChange(checked);
        }}
      />
    ) : (
      <Switch
        checked={value === true}
        disabled={isDisabled}
        onChange={(_event, checked) => {
          onChange(checked);
        }}
      />
    );

  return (
    <Stack spacing={0.25}>
      <FormControlLabel control={control} label={field.label} />
      {helperText !== undefined && (
        <Typography
          variant="caption"
          color={hasError ? "error" : "text.secondary"}
        >
          {helperText}
        </Typography>
      )}
    </Stack>
  );
};
