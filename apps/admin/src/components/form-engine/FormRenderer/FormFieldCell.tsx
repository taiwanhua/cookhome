import { createElement } from "react";
import { useTranslations } from "use-intl";

import type { FieldDef } from "@repo/domain/form";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import type {
  FieldUiState,
  FormRendererMode,
} from "@/lib/form-engine/field-states";
import type { FormDisplayItemLike } from "@/lib/form-engine/value-text";

import { FormValue } from "../FormValue";
import { widgetOf } from "../widgets/widget-registry";
import type { WidgetContext } from "../widgets/widget-types";

export interface FormFieldCellProps {
  field: FieldDef;
  state: FieldUiState;
  value: unknown;
  mode: FormRendererMode;
  context: WidgetContext;
  onChange: (fieldKey: string, value: unknown) => void;
  /** api 回的值錯誤(`VALIDATION_FAILED` 的 `fieldErrors`) */
  errorMessage?: string | null;
  display?: readonly FormDisplayItemLike[];
  onDownload?: (field: FieldDef) => void;
}

/**
 * 一欄(欄位級三態之後的「看得到」那兩態):
 * - 唯讀模式、計算 / 固定值欄位 → 標籤 + 顯示值(`FormValue`;計算欄位缺依賴時是「—」)
 * - 其餘 → 登錄表的 widget;唯讀(沒有欄位級 edit、`readonlyWhen`)時停用並附原因
 */
export const FormFieldCell = ({
  field,
  state,
  value,
  mode,
  context,
  onChange,
  errorMessage,
  display,
  onDownload,
}: FormFieldCellProps) => {
  const t = useTranslations("admin.formEngine.renderer");
  const isDisplayOnly =
    mode === "readonly" ||
    (mode !== "design" && state.readonlyReason === "computed");

  if (isDisplayOnly) {
    return (
      <Stack spacing={0.25}>
        <Typography variant="caption" color="text.secondary">
          {field.label}
        </Typography>
        <Typography variant="body2" component="div">
          <FormValue
            field={field}
            value={value}
            {...(display !== undefined && { display })}
            {...(onDownload !== undefined && { onDownload })}
            text={{
              empty: t("empty"),
              yes: t("yes"),
              no: t("no"),
              unavailable: t("sourceUnavailable"),
            }}
          />
        </Typography>
        {mode !== "readonly" &&
          field.help !== undefined &&
          field.help !== null && (
            <Typography variant="caption" color="text.secondary">
              {field.help}
            </Typography>
          )}
      </Stack>
    );
  }

  const help = field.help ?? "";
  let helperText: string | undefined = help === "" ? undefined : help;
  if (state.readonlyReason === "permission") {
    helperText = t("readonlyPermission");
  } else if (state.readonlyReason === "condition") {
    helperText = t("readonlyCondition");
  }
  if (errorMessage !== undefined && errorMessage !== null) {
    helperText = errorMessage;
  }
  // 登錄表查到的是模組層常數元件(不是 render 內建立的),以 createElement 掛上
  return createElement(widgetOf(field.widget.kind), {
    field,
    value,
    onChange: (next: unknown) => {
      onChange(field.key, next);
    },
    isDisabled: state.readonly,
    isDesign: mode === "design",
    ...(helperText !== undefined && { helperText }),
    hasError: errorMessage !== undefined && errorMessage !== null,
    context,
  });
};
