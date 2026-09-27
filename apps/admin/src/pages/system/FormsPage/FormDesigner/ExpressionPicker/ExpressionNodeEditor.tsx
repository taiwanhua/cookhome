import { useTranslations } from "use-intl";

import {
  CONTEXT_VAR_PATHS,
  type Expression,
  type FieldDef,
} from "@repo/domain/form";
import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { SelectField } from "@repo/ui/select-field";
import { Stack } from "@repo/ui/stack";
import { Switch } from "@repo/ui/switch";
import { TextField } from "@repo/ui/text-field";

import {
  type ConstantKind,
  type ExpressionNodeKind,
  PICKER_OPERATORS,
  argsOf,
  constantKindOf,
  constantText,
  contextNode,
  fieldNode,
  nodeKindOf,
  operationNode,
  operatorOf,
  varPathOf,
  withArgs,
  withOperator,
} from "@/lib/form-engine/expression-tree";

export interface ExpressionNodeEditorProps {
  value: Expression;
  onChange: (value: Expression) => void;
  /** 可引用的欄位(不含欄位自己以外的限制;循環與受保護引用交給檢查器報錯) */
  fields: readonly FieldDef[];
  /** 這個節點在樹裡的位置(無障礙名稱與檢查器定位用;根為空字串) */
  path: string;
  depth: number;
}

const NODE_KINDS: readonly ExpressionNodeKind[] = [
  "field",
  "context",
  "constant",
  "operation",
];

const CONSTANT_KINDS: readonly ConstantKind[] = [
  "text",
  "number",
  "boolean",
  "null",
];

/** 換節點種類時的起點值(每一種各自一個工廠,回傳型別一致)。 */
const NODE_DEFAULTS: Readonly<
  Record<ExpressionNodeKind, (fields: readonly FieldDef[]) => Expression>
> = {
  field: (fields) => fieldNode(fields.at(0)?.key ?? ""),
  context: () => contextNode(CONTEXT_VAR_PATHS[0]),
  operation: () => operationNode("=="),
  constant: () => null,
};

const CONSTANT_DEFAULTS: Readonly<Record<ConstantKind, Expression>> = {
  text: "",
  number: 0,
  boolean: true,
  null: null,
};

const replaceArg = (
  value: Expression,
  index: number,
  next: Expression,
): Expression =>
  withArgs(value, (args) =>
    args.map((item, position) => (position === index ? next : item)),
  );

const removeArg = (value: Expression, index: number): Expression =>
  withArgs(value, (args) =>
    args.filter((_item, position) => position !== index),
  );

const childPathOf = (path: string, operator: string, index: number): string =>
  [path, operator, String(index)].filter((part) => part !== "").join(".");

/**
 * 表達式樹的一個節點(Spec 6a §5「設計器:結構化選擇器(欄位 / 運算 / 常數,可巢狀)」):先選種類,
 * 再選欄位 / 上下文路徑 / 常數值 / 運算子;運算節點的每個參數遞迴是一個節點。**不做文字輸入**,
 * 所以不會產生白名單外的運算子;深度、節點數、引用與循環仍由檢查器把關。
 */
export const ExpressionNodeEditor = ({
  value,
  onChange,
  fields,
  path,
  depth,
}: ExpressionNodeEditorProps) => {
  const t = useTranslations("admin.forms.expression");
  const kind = nodeKindOf(value);
  const at = path === "" ? t("root") : path;

  return (
    <Stack
      spacing={1}
      sx={{
        pl: depth === 0 ? 0 : 1.5,
        borderLeft: depth === 0 ? 0 : 2,
        borderColor: "divider",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}
      >
        <SelectField<ExpressionNodeKind>
          label={t("kind", { path: at })}
          value={kind}
          options={NODE_KINDS.map((item) => ({
            value: item,
            label: t(`kinds.${item}`),
          }))}
          onChange={(next) => {
            onChange(NODE_DEFAULTS[next](fields));
          }}
          size="small"
          sx={{ minWidth: 120 }}
        />
        {kind === "field" && (
          <SelectField
            label={t("field")}
            value={varPathOf(value)}
            options={fields.map((field) => ({
              value: field.key,
              label: `${field.label}(${field.key})`,
            }))}
            onChange={(next) => {
              onChange(fieldNode(next));
            }}
            size="small"
            sx={{ minWidth: 160 }}
          />
        )}
        {kind === "context" && (
          <SelectField<string>
            label={t("context")}
            value={varPathOf(value)}
            options={CONTEXT_VAR_PATHS.map((item) => ({
              value: item,
              label: t(`contexts.${item}`),
            }))}
            onChange={(next) => {
              onChange(contextNode(next));
            }}
            size="small"
            sx={{ minWidth: 160 }}
          />
        )}
        {kind === "operation" && (
          <SelectField<string>
            label={t("operator")}
            value={operatorOf(value) ?? ""}
            options={PICKER_OPERATORS.map((item) => ({
              value: item,
              label: t(`operators.${item}`),
            }))}
            onChange={(next) => {
              onChange(withOperator(value, next));
            }}
            size="small"
            sx={{ minWidth: 160 }}
          />
        )}
        {kind === "constant" && (
          <>
            <SelectField<ConstantKind>
              label={t("constantKind")}
              value={constantKindOf(value)}
              options={CONSTANT_KINDS.map((item) => ({
                value: item,
                label: t(`constants.${item}`),
              }))}
              onChange={(next) => {
                onChange(CONSTANT_DEFAULTS[next]);
              }}
              size="small"
              sx={{ minWidth: 110 }}
            />
            {typeof value === "boolean" ? (
              <Switch
                checked={value}
                onChange={(_event, checked) => {
                  onChange(checked);
                }}
                slotProps={{ input: { "aria-label": t("booleanValue") } }}
              />
            ) : (
              constantKindOf(value) !== "null" && (
                <TextField
                  label={t("constantValue")}
                  size="small"
                  value={constantText(value)}
                  type={typeof value === "number" ? "number" : "text"}
                  onChange={(event) => {
                    onChange(
                      typeof value === "number"
                        ? Number(event.target.value)
                        : event.target.value,
                    );
                  }}
                />
              )
            )}
          </>
        )}
      </Stack>
      {kind === "operation" && (
        <Box>
          <Stack spacing={1}>
            {argsOf(value).map((arg, index) => (
              <Stack
                key={`${path}.${String(index)}`}
                direction="row"
                spacing={1}
                sx={{ alignItems: "flex-start" }}
              >
                <Box sx={{ flex: 1 }}>
                  <ExpressionNodeEditor
                    value={arg}
                    onChange={(next) => {
                      onChange(replaceArg(value, index, next));
                    }}
                    fields={fields}
                    path={childPathOf(path, operatorOf(value) ?? "", index)}
                    depth={depth + 1}
                  />
                </Box>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    onChange(removeArg(value, index));
                  }}
                >
                  {t("removeArg")}
                </Button>
              </Stack>
            ))}
            <Stack direction="row">
              <Button
                variant="text"
                size="small"
                onClick={() => {
                  onChange(withArgs(value, (args) => [...args, null]));
                }}
              >
                {t("addArg")}
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}
    </Stack>
  );
};
