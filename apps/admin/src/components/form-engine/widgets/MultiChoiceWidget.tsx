import { useState } from "react";
import { useTranslations } from "use-intl";

import { Autocomplete } from "@repo/ui/autocomplete";
import { Checkbox } from "@repo/ui/checkbox";
import { FormControlLabel } from "@repo/ui/form-control-label";
import { SelectField } from "@repo/ui/select-field";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import { identityOf } from "@/lib/form-engine/value-text";

import { customOptionOf, storedOfValue, withCurrent } from "./choice-options";
import { useFieldOptions } from "./useFieldOptions";
import type { ChoiceOption, WidgetProps } from "./widget-types";

/**
 * 多選欄(`multiSelect` → `checkboxGroup` / `multiDropdown` / `autocompleteMulti`)。
 * 存值是單選存值的陣列;`allowCustom` 只有 `autocompleteMulti` 能開。
 */
export const MultiChoiceWidget = (props: WidgetProps) => {
  const { field, value, onChange, isDisabled, isDesign, helperText, hasError } =
    props;
  const t = useTranslations("admin.formEngine.widgets");
  const [keyword, setKeyword] = useState("");
  const source = useFieldOptions({
    field,
    context: props.context,
    keyword,
    isDesign,
  });
  const currentItems: readonly unknown[] = Array.isArray(value) ? value : [];
  const options = withCurrent(source.options, currentItems);
  const selected = currentItems.map((item) => identityOf(item));
  const note = source.isUnavailable ? t("optionsUnavailable") : helperText;
  const isLocked = isDisabled || source.isUnavailable;
  const emit = (values: readonly string[]) => {
    onChange(values.map((item) => storedOfValue(options, item)));
  };

  if (field.widget.kind === "autocompleteMulti") {
    const custom =
      field.rules?.allowCustom === true
        ? customOptionOf(keyword, options)
        : null;
    const listed: ChoiceOption[] =
      custom === null
        ? options
        : [
            ...options,
            { ...custom, label: t("customOption", { value: custom.label }) },
          ];
    return (
      <Autocomplete<ChoiceOption, true>
        multiple
        label={field.label}
        options={listed}
        value={options.filter((option) => selected.includes(option.value))}
        getOptionLabel={(option) => option.label}
        getOptionKey={(option) => option.value}
        onChange={(next) => {
          onChange(
            next.map((option) =>
              option.value === custom?.value ? custom.stored : option.stored,
            ),
          );
        }}
        onInputChange={setKeyword}
        loading={source.isLoading}
        loadingText={t("loading")}
        noOptionsText={t("noOptions")}
        disabled={isLocked}
        error={hasError}
        helperText={note}
        size="small"
        fullWidth
      />
    );
  }

  if (field.widget.kind === "multiDropdown") {
    return (
      <SelectField
        multiple
        label={field.label}
        value={selected}
        options={options.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
        onChange={emit}
        disabled={isLocked}
        error={hasError}
        helperText={note}
        size="small"
        fullWidth
      />
    );
  }

  return (
    <Stack spacing={0.25} role="group" aria-label={field.label}>
      <Typography variant="body2" color="text.secondary">
        {field.label}
      </Typography>
      <Stack direction="row" sx={{ flexWrap: "wrap" }}>
        {options.map((option) => (
          <FormControlLabel
            key={option.value}
            label={option.label}
            control={
              <Checkbox
                checked={selected.includes(option.value)}
                disabled={isLocked}
                onChange={(_event, checked) => {
                  emit(
                    checked
                      ? [...selected, option.value]
                      : selected.filter((item) => item !== option.value),
                  );
                }}
              />
            }
          />
        ))}
      </Stack>
      {note !== undefined && (
        <Typography
          variant="caption"
          color={hasError ? "error" : "text.secondary"}
        >
          {note}
        </Typography>
      )}
    </Stack>
  );
};
