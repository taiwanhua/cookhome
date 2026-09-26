import { useTranslations } from "use-intl";

import type { Expression } from "@repo/domain/form";
import { SelectField } from "@repo/ui/select-field";
import { Switch } from "@repo/ui/switch";
import { TextField } from "@repo/ui/text-field";

import {
  type ConstantKind,
  constantDefaultOf,
  constantKindOf,
  constantText,
} from "@/lib/form-engine/expression-tree";

import { ListConstantField } from "./ListConstantField";

export interface ConstantEditorProps {
  value: Expression;
  onChange: (value: Expression) => void;
  /** 這個位置型別對得上的常數種類(型別導向;目前的種類不在清單裡時仍列出,才看得到舊值) */
  kinds: readonly ConstantKind[];
}

/** 輸入框直接打字的種類(日期用原生日期輸入)。 */
const TYPED_KINDS: ReadonlySet<ConstantKind> = new Set([
  "text",
  "number",
  "date",
]);

/** 常數節點:先選種類(文字 / 數字 / 是否 / 日期 / 清單 / 空值),再填值;不從文字猜型別。 */
export const ConstantEditor = ({
  value,
  onChange,
  kinds,
}: ConstantEditorProps) => {
  const t = useTranslations("admin.forms.expression");
  const kind = constantKindOf(value);
  const choices = kinds.includes(kind) ? kinds : [...kinds, kind];

  return (
    <>
      <SelectField<ConstantKind>
        label={t("constantKind")}
        value={kind}
        options={choices.map((item) => ({
          value: item,
          label: t(`constants.${item}`),
        }))}
        onChange={(next) => {
          onChange(constantDefaultOf(next));
        }}
        size="small"
        sx={{ minWidth: 110 }}
      />
      {kind === "boolean" && (
        <Switch
          checked={value === true}
          onChange={(_event, checked) => {
            onChange(checked);
          }}
          slotProps={{ input: { "aria-label": t("booleanValue") } }}
        />
      )}
      {TYPED_KINDS.has(kind) && (
        <TextField
          label={t("constantValue")}
          size="small"
          value={constantText(value)}
          type={kind}
          onChange={(event) => {
            onChange(
              kind === "number"
                ? Number(event.target.value)
                : event.target.value,
            );
          }}
          {...(kind === "date" && {
            slotProps: { inputLabel: { shrink: true } },
          })}
        />
      )}
      {kind === "list" && (
        <ListConstantField
          value={value}
          onChange={onChange}
          label={t("listValue")}
        />
      )}
    </>
  );
};
