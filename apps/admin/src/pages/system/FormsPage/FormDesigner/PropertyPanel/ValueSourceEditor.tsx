import { useTranslations } from "use-intl";

import type { FieldDef, ValueSource } from "@repo/domain/form";
import { SelectField } from "@repo/ui/select-field";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";

import { scalarText } from "@/lib/form-engine/value-text";

import { ExpressionPicker } from "../ExpressionPicker/ExpressionPicker";

export interface ValueSourceEditorProps {
  field: FieldDef;
  fields: readonly FieldDef[];
  onChange: (valueSource: ValueSource) => void;
  exprIssues: readonly string[];
}

type SourceKind = ValueSource["kind"];

const SOURCE_KINDS: readonly SourceKind[] = ["input", "computed", "constant"];

/**
 * 值的來源(Spec 6a §5 `valueSource`):使用者填 / 計算(公式,結構化選擇器)/ 固定值(可不放進版面)。
 * 計算與固定值欄位填寫時唯讀,送出時後端重算並以後端為準。
 */
export const ValueSourceEditor = ({
  field,
  fields,
  onChange,
  exprIssues,
}: ValueSourceEditorProps) => {
  const t = useTranslations("admin.forms.property");
  const source = field.valueSource;
  const others = fields.filter((candidate) => candidate.key !== field.key);

  return (
    <Stack spacing={1.5}>
      <SelectField<SourceKind>
        label={t("valueSource")}
        value={source.kind}
        options={SOURCE_KINDS.map((kind) => ({
          value: kind,
          label: t(`sources.${kind}`),
        }))}
        onChange={(kind) => {
          if (kind === "computed") {
            onChange({ kind, expr: { "*": [null, null] } });
          } else if (kind === "constant") {
            onChange({ kind, value: null });
          } else {
            onChange({ kind });
          }
        }}
        size="small"
      />
      {source.kind === "computed" && (
        <ExpressionPicker
          label={t("formula")}
          value={source.expr}
          fields={others}
          initialOperator="*"
          issues={exprIssues}
          onChange={(expr) => {
            onChange({ kind: "computed", expr: expr ?? null });
          }}
        />
      )}
      {source.kind === "constant" && (
        <TextField
          label={t("constantValue")}
          size="small"
          value={scalarText(source.value)}
          onChange={(event) => {
            onChange({ kind: "constant", value: event.target.value });
          }}
        />
      )}
    </Stack>
  );
};
