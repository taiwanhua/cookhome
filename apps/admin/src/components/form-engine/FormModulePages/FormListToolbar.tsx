import { useTranslations } from "use-intl";

import { FormSubmissionStatus } from "@repo/graphql";
import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { SelectField } from "@repo/ui/select-field";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";
import { Tooltip } from "@repo/ui/tooltip";

import type { ModuleFormSummary } from "@/hooks/useModuleForms";

export interface FormListToolbarProps {
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  forms: readonly ModuleFormSummary[];
  formKey: string | null;
  onFormKeyChange: (formKey: string | null) => void;
  status: FormSubmissionStatus | null;
  onStatusChange: (status: FormSubmissionStatus | null) => void;
  /** 綁了新增頁且有 `create` 才出現新增鈕 */
  canCreate: boolean;
  /** 此刻沒有可新增的表單(停用、收回、退役)→ 新增鈕停用並附原因 */
  hasForms: boolean;
  onCreate: () => void;
}

const ALL = "" as const;

type StatusFilter = typeof ALL | FormSubmissionStatus;

/** 表單模組列表的工具列(Spec 6a §8 畫面 8):搜尋(摘要標題)、依表單 / 狀態篩選、新增。 */
export const FormListToolbar = ({
  keyword,
  onKeywordChange,
  forms,
  formKey,
  onFormKeyChange,
  status,
  onStatusChange,
  canCreate,
  hasForms,
  onCreate,
}: FormListToolbarProps) => {
  const t = useTranslations("admin.formEngine.pages");

  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1.5 }}
    >
      <TextField
        label={t("search")}
        placeholder={t("searchPlaceholder")}
        size="small"
        value={keyword}
        sx={{ width: 240 }}
        onChange={(event) => {
          onKeywordChange(event.target.value);
        }}
      />
      <SelectField
        label={t("formFilter")}
        value={formKey ?? ALL}
        displayEmpty
        size="small"
        sx={{ width: 200 }}
        options={[
          { value: ALL, label: t("allForms") },
          ...forms.map((form) => ({ value: form.key, label: form.name })),
        ]}
        onChange={(next) => {
          onFormKeyChange(next === ALL ? null : next);
        }}
      />
      <SelectField<StatusFilter>
        label={t("statusFilter")}
        value={status ?? ALL}
        displayEmpty
        size="small"
        sx={{ width: 160 }}
        options={[
          { value: ALL, label: t("allStatuses") },
          { value: FormSubmissionStatus.Draft, label: t("statusDraft") },
          {
            value: FormSubmissionStatus.Completed,
            label: t("statusCompleted"),
          },
        ]}
        onChange={(next) => {
          onStatusChange(next === ALL ? null : next);
        }}
      />
      <Box sx={{ flex: 1 }} />
      {canCreate && (
        <Tooltip title={hasForms ? "" : t("noFormsHint")}>
          <Button disabled={!hasForms} onClick={onCreate}>
            {t("create")}
          </Button>
        </Tooltip>
      )}
    </Stack>
  );
};
