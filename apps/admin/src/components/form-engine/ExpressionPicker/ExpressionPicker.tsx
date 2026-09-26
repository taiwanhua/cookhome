import { useTranslations } from "use-intl";

import type { Expression, FieldDef } from "@repo/domain/form";
import { Button } from "@repo/ui/button";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import { operationNode } from "@/lib/form-engine/expression-tree";

import { JsonPreview } from "../../JsonPreview";
import { ExpressionNodeEditor } from "./ExpressionNodeEditor";

export interface ExpressionPickerProps {
  label: string;
  /** undefined / null = 沒有設定 */
  value: Expression | undefined;
  onChange: (value: Expression | null) => void;
  fields: readonly FieldDef[];
  /** 新設定時的起點(公式預設相乘、條件預設比較) */
  initialOperator?: string;
  /** 檢查器指到這個表達式的錯誤(就地顯示) */
  issues?: readonly string[];
}

/**
 * 表達式欄位(公式、顯示條件、唯讀條件、自訂驗證):沒設定時一顆「設定」;設定後是結構化選擇器,
 * 下方附唯讀的 JSON 預覽(可複製,Spec 6a §5「右側 JSON 預覽唯讀可複製」)。
 */
export const ExpressionPicker = ({
  label,
  value,
  onChange,
  fields,
  initialOperator = "==",
  issues = [],
}: ExpressionPickerProps) => {
  const t = useTranslations("admin.forms.expression");
  const isSet = value !== undefined && value !== null;

  return (
    <Stack spacing={1} role="group" aria-label={label}>
      <Stack direction="row" sx={{ alignItems: "center" }}>
        <Typography variant="body2" sx={{ flex: 1 }}>
          {label}
        </Typography>
        {isSet ? (
          <Button
            variant="text"
            size="small"
            onClick={() => {
              onChange(null);
            }}
          >
            {t("clear")}
          </Button>
        ) : (
          <Button
            variant="text"
            size="small"
            onClick={() => {
              onChange(operationNode(initialOperator));
            }}
          >
            {t("set")}
          </Button>
        )}
      </Stack>
      {isSet && (
        <>
          <ExpressionNodeEditor
            value={value}
            onChange={onChange}
            fields={fields}
            path=""
            depth={0}
          />
          <JsonPreview value={value} label={t("json", { label })} />
        </>
      )}
      {issues.map((message) => (
        <Typography key={message} variant="caption" color="error">
          {message}
        </Typography>
      ))}
    </Stack>
  );
};
