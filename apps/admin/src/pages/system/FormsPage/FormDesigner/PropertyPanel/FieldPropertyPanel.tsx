import { useTranslations } from "use-intl";

import type {
  DefinitionIssue,
  ExpressionSlot,
  FieldDef,
} from "@repo/domain/form";
import { Button } from "@repo/ui/button";
import { FormControlLabel } from "@repo/ui/form-control-label";
import { Stack } from "@repo/ui/stack";
import { Switch } from "@repo/ui/switch";
import { Typography } from "@repo/ui/typography";

import { ExpressionPicker } from "../ExpressionPicker/ExpressionPicker";
import { FieldBasicsEditor } from "./FieldBasicsEditor";
import { LookupSourceEditor } from "./LookupSourceEditor";
import { OptionsEditor } from "./OptionsEditor";
import { RulesEditor } from "./RulesEditor";
import { ValueSourceEditor } from "./ValueSourceEditor";

export interface FieldPropertyPanelProps {
  field: FieldDef;
  fields: readonly FieldDef[];
  span: number | null;
  /** 檢查器指到這個欄位的錯誤與警告(點檢查結果定位到這裡) */
  issues: readonly DefinitionIssue[];
  onChange: (field: FieldDef) => void;
  onSpanChange: (span: number) => void;
  onDelete: () => void;
  /** 回到表單層設定(摘要槽、帶入規則) */
  onBack: () => void;
}

/**
 * 屬性面板(Spec 6a §8 畫面 2):選中欄位的定義。表達式一律用結構化選擇器;每一塊的檢查器錯誤就地顯示
 * (表達式槽依 `location.exprSlot` 分派),其餘列在最上方。
 */
export const FieldPropertyPanel = ({
  field,
  fields,
  span,
  issues,
  onChange,
  onSpanChange,
  onDelete,
  onBack,
}: FieldPropertyPanelProps) => {
  const t = useTranslations("admin.forms.property");
  const others = fields.filter((candidate) => candidate.key !== field.key);
  const slotIssues = (slot: ExpressionSlot) =>
    issues
      .filter((issue) => issue.location.exprSlot === slot)
      .map((issue) => issue.message);
  const general = issues.filter(
    (issue) => issue.location.exprSlot === undefined,
  );
  const permission = field.permission ?? { show: false, edit: false };

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ alignItems: "center" }}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          {t("title", { label: field.label })}
        </Typography>
        <Button variant="text" size="small" onClick={onBack}>
          {t("backToSettings")}
        </Button>
      </Stack>
      {general.length > 0 && (
        <Stack spacing={0.5} role="list" aria-label={t("issues")}>
          {general.map((issue, index) => (
            <Typography
              key={`${issue.code}-${String(index)}`}
              role="listitem"
              variant="caption"
              color="error"
            >
              {issue.message}
            </Typography>
          ))}
        </Stack>
      )}
      <FieldBasicsEditor
        field={field}
        span={span}
        onChange={onChange}
        onSpanChange={onSpanChange}
      />
      <ValueSourceEditor
        field={field}
        fields={fields}
        exprIssues={slotIssues("valueSource.expr")}
        onChange={(valueSource) => {
          onChange({ ...field, valueSource });
        }}
      />
      {(field.type === "select" || field.type === "multiSelect") && (
        <OptionsEditor
          value={field.options}
          onChange={(options) => {
            onChange({ ...field, options });
          }}
        />
      )}
      {field.type === "reference" && (
        <LookupSourceEditor
          value={field.source ?? { provider: "user", labelField: "name" }}
          hasValueField={false}
          onChange={(source) => {
            onChange({ ...field, source });
          }}
        />
      )}
      <RulesEditor
        field={field}
        fields={others}
        customIssues={slotIssues("rules.custom")}
        onChange={(rules) => {
          onChange({ ...field, rules });
        }}
      />
      <ExpressionPicker
        label={t("visibleWhen")}
        value={field.visibleWhen}
        fields={others}
        issues={slotIssues("visibleWhen")}
        onChange={(visibleWhen) => {
          onChange({ ...field, visibleWhen });
        }}
      />
      <ExpressionPicker
        label={t("readonlyWhen")}
        value={field.readonlyWhen}
        fields={fields}
        issues={slotIssues("readonlyWhen")}
        onChange={(readonlyWhen) => {
          onChange({ ...field, readonlyWhen });
        }}
      />
      <Stack spacing={0.5}>
        <FormControlLabel
          label={t("permissionShow")}
          control={
            <Switch
              checked={permission.show}
              onChange={(_event, checked) => {
                onChange({
                  ...field,
                  permission: { ...permission, show: checked },
                });
              }}
            />
          }
        />
        <FormControlLabel
          label={t("permissionEdit")}
          control={
            <Switch
              checked={permission.edit}
              onChange={(_event, checked) => {
                onChange({
                  ...field,
                  permission: { ...permission, edit: checked },
                });
              }}
            />
          }
        />
        <Typography variant="caption" color="text.secondary">
          {t("permissionHint")}
        </Typography>
      </Stack>
      <Stack direction="row">
        <Button variant="text" color="error" onClick={onDelete}>
          {t("delete")}
        </Button>
      </Stack>
    </Stack>
  );
};
