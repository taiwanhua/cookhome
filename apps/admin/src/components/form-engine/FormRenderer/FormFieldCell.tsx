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
import { DerivedFieldCell } from "./DerivedFieldCell";

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
 * - 唯讀模式 → 標籤 + 顯示值(`FormValue`)
 * - 計算 / 固定值欄位(設計畫布、填寫、預覽)→ **有框的唯讀輸入框**(同其他停用欄位的外觀,Spec 6a §5 表 A 下方),
 *   內容是顯示值(計算欄位缺依賴時是「—」)
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
  const text = {
    empty: t("empty"),
    yes: t("yes"),
    no: t("no"),
    unavailable: t("sourceUnavailable"),
  };
  const help = field.help ?? "";

  if (mode !== "readonly" && field.valueSource.kind !== "input") {
    return (
      <DerivedFieldCell
        field={field}
        value={value}
        text={text}
        errorMessage={errorMessage ?? null}
        {...(display !== undefined && { display })}
      />
    );
  }

  if (mode === "readonly") {
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
            text={text}
          />
        </Typography>
      </Stack>
    );
  }

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
