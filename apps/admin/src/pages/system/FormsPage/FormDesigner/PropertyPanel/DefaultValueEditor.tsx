import { createElement } from "react";
import { useTranslations } from "use-intl";

import {
  FIELD_EXPRESSION_TYPES,
  type FieldDef,
  type FieldDefault,
  REFERENCE_DEFAULT_PATHS,
  defaultKindsOf,
} from "@repo/domain/form";
import { Button } from "@repo/ui/button";
import { DatePicker } from "@repo/ui/date-picker";
import { DateTimePicker } from "@repo/ui/date-time-picker";
import { SelectField } from "@repo/ui/select-field";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";
import { Typography } from "@repo/ui/typography";

import { ExpressionPicker } from "@/components/form-engine/ExpressionPicker/ExpressionPicker";
import { widgetOf } from "@/components/form-engine/widgets/widget-registry";
import { initialExpressionOf } from "@/lib/form-engine/expression-options";
import { scalarText } from "@/lib/form-engine/value-text";

export interface DefaultValueEditorProps {
  field: FieldDef;
  fields: readonly FieldDef[];
  /** 類別 / lookup 選項欄用填寫時的選擇器挑,要知道查哪張表單(草稿) */
  formKey: string;
  /** 預設值公式(`default.expr`)的檢查結果 */
  exprIssues: readonly string[];
  onChange: (value: FieldDefault | null) => void;
}

type PartProps = DefaultValueEditorProps & { constant: unknown };

const NONE = "";

/** 引用欄預設值目前選的系統值路徑(`{ var: "ctx.user.id" }` → `ctx.user.id`);沒設為空字串。 */
const referencePathOf = (value: FieldDefault | null | undefined): string => {
  if (value?.kind !== "expression") {
    return NONE;
  }
  const expr = value.expr as { var?: unknown } | null;
  const raw: unknown = expr?.var;
  const path: unknown = Array.isArray(raw) ? (raw as unknown[])[0] : raw;
  return typeof path === "string" ? path : NONE;
};

/** 空值(沒選、清空)= 拿掉預設值,不存 `{ kind: "constant", value: null }`。 */
const constantOf = (value: unknown): FieldDefault | null =>
  value === null || value === "" ? null : { kind: "constant", value };

/** 引用:只能系統值「填寫者 / 填寫者的組織」。 */
const ReferenceDefault = ({ field, onChange }: PartProps) => {
  const t = useTranslations("admin.forms.property");
  return (
    <SelectField<string>
      label={t("defaultValue")}
      value={referencePathOf(field.default)}
      displayEmpty
      options={[
        { value: NONE, label: t("defaultKinds.none") },
        ...REFERENCE_DEFAULT_PATHS.map((path) => ({
          value: path,
          label: t(`defaultSystem.${path === "ctx.user.id" ? "user" : "org"}`),
        })),
      ]}
      onChange={(path) => {
        onChange(
          path === NONE ? null : { kind: "expression", expr: { var: path } },
        );
      }}
      size="small"
    />
  );
};

/** 是否:固定值(是 / 否)。 */
const BooleanDefault = ({ constant, onChange }: PartProps) => {
  const t = useTranslations("admin.forms.property");
  return (
    <SelectField<string>
      label={t("defaultValue")}
      value={typeof constant === "boolean" ? String(constant) : NONE}
      displayEmpty
      options={[
        { value: NONE, label: t("defaultKinds.none") },
        { value: "true", label: t("defaultBoolean.true") },
        { value: "false", label: t("defaultBoolean.false") },
      ]}
      onChange={(next) => {
        onChange(constantOf(next === NONE ? null : next === "true"));
      }}
      size="small"
    />
  );
};

/** 單選 / 多選:靜態清單直接挑;類別 / 資料來源用填寫時的同一個選擇器挑(選項以已存的草稿查詢)。 */
const ChoiceDefault = ({ field, formKey, constant, onChange }: PartProps) => {
  const t = useTranslations("admin.forms.property");
  const options = field.options;
  if (options?.kind === "static") {
    const items = options.items
      .filter((item) => item.enabled)
      .map((item) => ({ value: item.value, label: item.label }));
    return field.type === "select" ? (
      <SelectField<string>
        label={t("defaultValue")}
        value={typeof constant === "string" ? constant : NONE}
        displayEmpty
        options={[{ value: NONE, label: t("defaultKinds.none") }, ...items]}
        onChange={(next) => {
          onChange(constantOf(next));
        }}
        size="small"
      />
    ) : (
      <SelectField<string>
        label={t("defaultValue")}
        multiple
        value={
          Array.isArray(constant)
            ? constant.filter(
                (item): item is string => typeof item === "string",
              )
            : []
        }
        options={items}
        onChange={(picked) => {
          onChange(constantOf(picked.length === 0 ? null : picked));
        }}
        size="small"
      />
    );
  }
  return (
    <Stack spacing={0.5}>
      {createElement(widgetOf(field.widget.kind), {
        field: { ...field, label: t("defaultValue") },
        value: constant,
        onChange: (next: unknown) => {
          onChange(
            constantOf(Array.isArray(next) && next.length === 0 ? null : next),
          );
        },
        isDisabled: false,
        isDesign: false,
        helperText: t("defaultPickerHint"),
        hasError: false,
        context: { formKey, version: null },
      })}
      {constant !== null && (
        <Stack direction="row">
          <Button
            variant="text"
            size="small"
            onClick={() => {
              onChange(null);
            }}
          >
            {t("defaultClear")}
          </Button>
        </Stack>
      )}
    </Stack>
  );
};

/** 固定值的輸入元件:日期 / 日期時間用選擇器,其餘用輸入框。 */
const ConstantInput = ({ field, constant, onChange }: PartProps) => {
  const t = useTranslations("admin.forms.property");
  const text = typeof constant === "string" ? constant : null;
  const set = (value: unknown) => {
    onChange({ kind: "constant", value });
  };
  if (field.type === "date") {
    return (
      <DatePicker
        label={t("defaultConstant")}
        value={text}
        onChange={set}
        size="small"
      />
    );
  }
  if (field.type === "datetime") {
    return (
      <DateTimePicker
        label={t("defaultConstant")}
        value={text}
        onChange={set}
        size="small"
      />
    );
  }
  return (
    <TextField
      label={t("defaultConstant")}
      size="small"
      type={field.type === "number" ? "number" : "text"}
      value={scalarText(constant)}
      onChange={(event) => {
        set(event.target.value);
      }}
    />
  );
};

/** 文字 / 多行 / 數字 / 日期 / 日期時間:不設 / 固定值 / 公式(根型別 = 欄位型別,不可引用自己)。 */
const ScalarDefault = (props: PartProps) => {
  const { field, fields, exprIssues, onChange } = props;
  const t = useTranslations("admin.forms.property");
  const current = field.default ?? null;
  const resultType = FIELD_EXPRESSION_TYPES[field.type];
  return (
    <Stack spacing={1}>
      <SelectField<string>
        label={t("defaultValue")}
        value={current?.kind ?? NONE}
        displayEmpty
        options={[
          { value: NONE, label: t("defaultKinds.none") },
          ...defaultKindsOf(field.type).map((item) => ({
            value: item,
            label: t(`defaultKinds.${item}`),
          })),
        ]}
        onChange={(next) => {
          if (next === "expression") {
            onChange({
              kind: "expression",
              expr: initialExpressionOf(
                resultType === null ? null : [resultType],
              ),
            });
          } else {
            onChange(
              next === "constant" ? { kind: "constant", value: null } : null,
            );
          }
        }}
        size="small"
      />
      {current?.kind === "expression" && (
        <ExpressionPicker
          label={t("defaultFormula")}
          value={current.expr}
          fields={fields.filter((candidate) => candidate.key !== field.key)}
          usage="formula"
          resultType={resultType}
          issues={exprIssues}
          onChange={(expr) => {
            onChange({ kind: "expression", expr: expr ?? null });
          }}
        />
      )}
      {current?.kind === "constant" && <ConstantInput {...props} />}
      <Typography variant="caption" color="text.secondary">
        {t("defaultHint")}
      </Typography>
    </Stack>
  );
};

/**
 * 預設值(Spec 6a §5「預設值」、表 A「預設值」列;值來源 = 使用者填才出現,上傳沒有):
 * - 文字 / 多行 / 數字 / 日期 / 日期時間:固定值或公式(公式根型別 = 欄位型別,不可引用自己)
 * - 單選 / 多選:從選項挑 —— 靜態清單直接挑;類別 / 資料來源用填寫時的同一個選擇器挑
 * - 是否:固定值(是 / 否);引用:只能系統值「填寫者 / 填寫者的組織」
 *
 * 使用者沒改過這個欄位前,它依賴的欄位變了會跟著重算;改過就停。
 */
export const DefaultValueEditor = (props: DefaultValueEditorProps) => {
  const current = props.field.default ?? null;
  const parts: PartProps = {
    ...props,
    constant: current?.kind === "constant" ? current.value : null,
  };
  switch (props.field.type) {
    case "reference": {
      return <ReferenceDefault {...parts} />;
    }
    case "boolean": {
      return <BooleanDefault {...parts} />;
    }
    case "select":
    case "multiSelect": {
      return <ChoiceDefault {...parts} />;
    }
    default: {
      return <ScalarDefault {...parts} />;
    }
  }
};
