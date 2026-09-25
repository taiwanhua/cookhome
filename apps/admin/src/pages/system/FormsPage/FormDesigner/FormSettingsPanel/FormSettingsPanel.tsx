import { useTranslations } from "use-intl";

import type { FormDefinition, SummarySlot } from "@repo/domain/form";
import { Button } from "@repo/ui/button";
import { SelectField } from "@repo/ui/select-field";
import { Stack } from "@repo/ui/stack";
import { Typography } from "@repo/ui/typography";

import type { DesignerIssue } from "@/lib/form-engine/designer-issues";

import { PrefillEditor } from "./PrefillEditor";

export interface FormSettingsPanelProps {
  definition: FormDefinition;
  /** 摘要槽與帶入規則的檢查器錯誤(`location.summarySlot` / `prefillIndex`) */
  issues: readonly DesignerIssue[];
  onChange: (definition: FormDefinition) => void;
}

const SLOTS: readonly SummarySlot[] = ["title", "date", "amount"];
const UNSET = "";

/**
 * 沒選欄位時的屬性面板 = 表單層設定:摘要槽(每版必填 `title`,選填 `date` / `amount`;
 * 型別限制與「不能對到受保護欄位」由檢查器報錯)與帶入規則。
 */
export const FormSettingsPanel = ({
  definition,
  issues,
  onChange,
}: FormSettingsPanelProps) => {
  const t = useTranslations("admin.forms.settings");
  const slotIssue = (slot: SummarySlot) =>
    issues.find((issue) => issue.location.summarySlot === slot)?.message;

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">{t("title")}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t("summaryHint")}
      </Typography>
      {SLOTS.map((slot) => (
        <SelectField
          key={slot}
          label={t(`slots.${slot}`)}
          value={definition.summaryMap[slot] ?? UNSET}
          displayEmpty
          options={[
            { value: UNSET, label: t("slotUnset") },
            ...definition.fields.map((field) => ({
              value: field.key,
              label: `${field.label}(${field.key})`,
            })),
          ]}
          onChange={(fieldKey) => {
            onChange({
              ...definition,
              summaryMap: {
                ...definition.summaryMap,
                [slot]: fieldKey === UNSET ? null : fieldKey,
              },
            });
          }}
          error={slotIssue(slot) !== undefined}
          helperText={slotIssue(slot)}
          size="small"
        />
      ))}
      <Typography variant="subtitle2">{t("prefills")}</Typography>
      {definition.prefills.map((prefill, index) => (
        <Stack key={`prefill-${String(index)}`} spacing={0.5}>
          <PrefillEditor
            prefill={prefill}
            index={index}
            fields={definition.fields}
            onChange={(next) => {
              onChange({
                ...definition,
                prefills: definition.prefills.map((item, at) =>
                  at === index ? next : item,
                ),
              });
            }}
            onRemove={() => {
              onChange({
                ...definition,
                prefills: definition.prefills.filter(
                  (_item, at) => at !== index,
                ),
              });
            }}
          />
          {issues
            .filter((issue) => issue.location.prefillIndex === index)
            .map((issue, position) => (
              <Typography
                key={`${issue.code}-${String(position)}`}
                variant="caption"
                color="error"
              >
                {issue.message}
              </Typography>
            ))}
        </Stack>
      ))}
      <Stack direction="row">
        <Button
          variant="text"
          size="small"
          onClick={() => {
            onChange({
              ...definition,
              prefills: [
                ...definition.prefills,
                {
                  label: t("newPrefill"),
                  source: { provider: "user", labelField: "name" },
                  mapping: [],
                },
              ],
            });
          }}
        >
          {t("addPrefill")}
        </Button>
      </Stack>
    </Stack>
  );
};
