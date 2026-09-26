import { useTranslations } from "use-intl";

import {
  CONTEXT_VAR_PATHS,
  type Expression,
  type FieldDef,
  type FieldTypeLookup,
  OPERATOR_SIGNATURES,
  expectedTypesAt,
  paramSpecAt,
} from "@repo/domain/form";
import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { SelectField } from "@repo/ui/select-field";
import { Stack } from "@repo/ui/stack";

import {
  EQUALITY_OPERATORS,
  type PickerPosition,
  type PositionOptions,
  positionOptionsOf,
} from "@/lib/form-engine/expression-options";
import {
  CONSTANT_KINDS,
  type ExpressionNodeKind,
  PICKER_OPERATORS,
  type PickerOperator,
  argsOf,
  constantDefaultOf,
  constantKindOf,
  contextNode,
  fieldNode,
  nodeKindOf,
  operationNode,
  operatorOf,
  varPathOf,
  withArgs,
  withOperator,
} from "@/lib/form-engine/expression-tree";

import { ConstantEditor } from "./ConstantEditor";
import { SpecialArgEditor } from "./SpecialArgEditor";

export interface ExpressionNodeEditorProps {
  value: Expression;
  onChange: (value: Expression) => void;
  /** 可引用的欄位(呼叫端已依用途過濾:條件不含受保護欄位、顯示條件不含自己) */
  fields: readonly FieldDef[];
  /** 這個位置要什麼型別、用途、是不是根(型別導向過濾) */
  position: PickerPosition;
  fieldTypeOf: FieldTypeLookup;
  /** 這個節點在樹裡的位置(無障礙名稱與檢查器定位用;根為空字串) */
  path: string;
  depth: number;
}

/** 換節點種類時的起點值:取這個位置第一個型別對得上的選項。 */
const NODE_DEFAULTS: Readonly<
  Record<ExpressionNodeKind, (options: PositionOptions) => Expression>
> = {
  field: (options) => fieldNode(options.fields.at(0)?.key ?? ""),
  context: (options) =>
    contextNode(options.contexts.at(0) ?? CONTEXT_VAR_PATHS[0]),
  operation: (options) => operationNode(options.operators.at(0) ?? "=="),
  constant: (options) =>
    constantDefaultOf(options.constants.at(0) ?? CONSTANT_KINDS[0]),
};

/** 設定第 `index` 個參數(位置還不存在時補 null;`dateDiff` 舊資料只有兩個參數時寫單位用)。 */
const setArg = (
  value: Expression,
  index: number,
  next: Expression,
): Expression =>
  withArgs(value, (args) => {
    const padded = [
      ...args,
      ...Array.from(
        { length: Math.max(0, index + 1 - args.length) },
        () => null,
      ),
    ];
    return padded.map((item, position) => (position === index ? next : item));
  });

const removeArg = (value: Expression, index: number): Expression =>
  withArgs(value, (args) =>
    args.filter((_item, position) => position !== index),
  );

const childPathOf = (path: string, operator: string, index: number): string =>
  [path, operator, String(index)].filter((part) => part !== "").join(".");

const isPickerOperator = (
  operator: string | null,
): operator is PickerOperator =>
  operator !== null &&
  (PICKER_OPERATORS as readonly string[]).includes(operator);

/** 目前的值不在選項裡(舊資料)時仍列出,SelectField 才顯示得出來。 */
const withCurrent = <Item extends string>(
  items: readonly Item[],
  current: Item | null,
): Item[] =>
  current === null || items.includes(current)
    ? [...items]
    : [...items, current];

/**
 * 表達式樹的一個節點(Spec 6a §5「表達式」+「表達式選擇器:型別導向(表 B)」):先選種類
 * (欄位 / 系統值 / 常數 / 運算),再選欄位 / 系統值 / 常數值 / 運算子;運算節點的每個參數遞迴是一個節點,
 * 各自帶該參數位置的**期望型別**往下傳,所以每一層只列型別對得上的東西。**不做文字輸入**,不會產生白名單外的
 * 運算子;深度、節點數、引用與循環仍由檢查器把關。
 */
export const ExpressionNodeEditor = ({
  value,
  onChange,
  fields,
  position,
  fieldTypeOf,
  path,
  depth,
}: ExpressionNodeEditorProps) => {
  const t = useTranslations("admin.forms.expression");
  const options = positionOptionsOf(position, fields);
  const kind = nodeKindOf(value);
  const at = path === "" ? t("root") : path;
  const operator = operatorOf(value);
  const signature = isPickerOperator(operator)
    ? OPERATOR_SIGNATURES[operator]
    : undefined;
  const args = argsOf(value);
  // dateDiff 的舊資料只有兩個參數:單位位置照樣顯示(缺參數視為天)
  const shownArgs =
    operator === "dateDiff" && args.length < 3
      ? [...args, ...Array.from({ length: 3 - args.length }, () => null)]
      : args;
  const fieldChoices = fields.filter(
    (field) => options.fields.includes(field) || field.key === varPathOf(value),
  );

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
          options={withCurrent(options.kinds, kind).map((item) => ({
            value: item,
            label: t(`kinds.${item}`),
          }))}
          onChange={(next) => {
            onChange(NODE_DEFAULTS[next](options));
          }}
          size="small"
          sx={{ minWidth: 120 }}
        />
        {kind === "field" && (
          <SelectField
            label={t("field")}
            value={varPathOf(value)}
            options={fieldChoices.map((field) => ({
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
            options={withCurrent<string>(
              options.contexts,
              varPathOf(value),
            ).map((item) => ({
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
            value={operator ?? ""}
            options={withCurrent<string>(options.operators, operator).map(
              (item) => ({ value: item, label: t(`operators.${item}`) }),
            )}
            onChange={(next) => {
              onChange(withOperator(value, next));
            }}
            size="small"
            sx={{ minWidth: 160 }}
          />
        )}
        {kind === "constant" && (
          <ConstantEditor
            value={value}
            onChange={onChange}
            kinds={withCurrent(options.constants, constantKindOf(value))}
          />
        )}
      </Stack>
      {kind === "operation" && isPickerOperator(operator) && (
        <Box>
          <Stack spacing={1}>
            {shownArgs.map((arg, index) => {
              const spec = paramSpecAt(operator, index);
              const isRemovable =
                spec === null ||
                (signature?.rest !== undefined &&
                  index >= signature.params.length);
              return (
                <Stack
                  key={`${path}.${String(index)}`}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "flex-start" }}
                >
                  <Box sx={{ flex: 1 }}>
                    {spec?.kind === "dateUnit" ||
                    spec?.kind === "optionField" ? (
                      <SpecialArgEditor
                        kind={spec.kind}
                        value={arg}
                        fields={fields}
                        onChange={(next) => {
                          onChange(setArg(value, index, next));
                        }}
                      />
                    ) : (
                      <ExpressionNodeEditor
                        value={arg}
                        onChange={(next) => {
                          onChange(setArg(value, index, next));
                        }}
                        fields={fields}
                        position={{
                          expected: expectedTypesAt(
                            operator,
                            index,
                            args,
                            position.expected,
                            fieldTypeOf,
                          ),
                          usage: position.usage,
                          isRoot: false,
                          allowNull: EQUALITY_OPERATORS.includes(operator),
                        }}
                        fieldTypeOf={fieldTypeOf}
                        path={childPathOf(path, operator, index)}
                        depth={depth + 1}
                      />
                    )}
                  </Box>
                  {isRemovable && (
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => {
                        onChange(removeArg(value, index));
                      }}
                    >
                      {t("removeArg")}
                    </Button>
                  )}
                </Stack>
              );
            })}
            {signature?.rest !== undefined && (
              <Stack direction="row">
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    onChange(withArgs(value, (items) => [...items, null]));
                  }}
                >
                  {t("addArg")}
                </Button>
              </Stack>
            )}
          </Stack>
        </Box>
      )}
    </Stack>
  );
};
