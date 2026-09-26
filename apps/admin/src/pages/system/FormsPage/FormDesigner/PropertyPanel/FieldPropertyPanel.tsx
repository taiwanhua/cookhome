import { useTranslations } from "use-intl";

import {
  ALLOW_CUSTOM_WIDGETS,
  type ExpressionSlot,
  type FieldDef,
} from "@repo/domain/form";
import { Button } from "@repo/ui/button";
import { FormControlLabel } from "@repo/ui/form-control-label";
import { Stack } from "@repo/ui/stack";
import { Switch } from "@repo/ui/switch";
import { Typography } from "@repo/ui/typography";

import { ExpressionPicker } from "@/components/form-engine/ExpressionPicker/ExpressionPicker";
import { widgetKindsFor } from "@/components/form-engine/widgets/widget-registry";
import type { DesignerIssue } from "@/lib/form-engine/designer-issues";
import type { FieldKeyProblem } from "@/lib/form-engine/designer-ops";
import { conditionFieldsOf } from "@/lib/form-engine/expression-options";
import { propertySectionsOf } from "@/lib/form-engine/property-sections";

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
  issues: readonly DesignerIssue[];
  /** 改 key 當場擋:null = 可以寫入;否則是原因(格式 / 保留字 / 重複) */
  keyProblemOf: (key: string) => FieldKeyProblem | null;
  onChange: (field: FieldDef) => void;
  onSpanChange: (span: number) => void;
  onDelete: () => void;
  /** 回到表單層設定(摘要槽、帶入規則) */
  onBack: () => void;
}

/**
 * 屬性面板(Spec 6a §8 畫面 2):選中欄位的定義,**每種型別只出現該有的設定**(§5 表 A,
 * `lib/form-engine/property-sections.ts`)。表達式一律用型別導向的結構化選擇器(表 B);條件類不列受保護欄位。
 * 每一塊的檢查器錯誤就地顯示(表達式槽依 `location.exprSlot` 分派),其餘列在最上方。
 */
export const FieldPropertyPanel = ({
  field,
  fields,
  span,
  issues,
  keyProblemOf,
  onChange,
  onSpanChange,
  onDelete,
  onBack,
}: FieldPropertyPanelProps) => {
  const t = useTranslations("admin.forms.property");
  const sections = propertySectionsOf(
    field,
    widgetKindsFor(field.type),
    ALLOW_CUSTOM_WIDGETS,
  );
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
        sections={sections}
        keyProblemOf={keyProblemOf}
        onChange={onChange}
        onSpanChange={onSpanChange}
      />
      {sections.valueSource && (
        <ValueSourceEditor
          field={field}
          fields={fields}
          exprIssues={slotIssues("valueSource.expr")}
          onChange={(valueSource) => {
            onChange({ ...field, valueSource });
          }}
        />
      )}
      {/* 預設值(值來源 = 使用者填才有,見 sections.defaultValue)的編輯器接在這裡 */}
      {sections.options && (
        <OptionsEditor
          value={field.options}
          onChange={(options) => {
            onChange({ ...field, options });
          }}
        />
      )}
      {sections.referenceSource && (
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
        fields={conditionFieldsOf(fields, field.key, true)}
        sections={sections}
        customIssues={slotIssues("rules.custom")}
        onChange={(rules) => {
          onChange({ ...field, rules });
        }}
      />
      <ExpressionPicker
        label={t("visibleWhen")}
        value={field.visibleWhen}
        fields={conditionFieldsOf(fields, field.key, false)}
        usage="condition"
        issues={slotIssues("visibleWhen")}
        onChange={(visibleWhen) => {
          onChange({ ...field, visibleWhen });
        }}
      />
      {sections.readonlyWhen && (
        <ExpressionPicker
          label={t("readonlyWhen")}
          value={field.readonlyWhen}
          fields={conditionFieldsOf(fields, field.key, true)}
          usage="condition"
          issues={slotIssues("readonlyWhen")}
          onChange={(readonlyWhen) => {
            onChange({ ...field, readonlyWhen });
          }}
        />
      )}
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
