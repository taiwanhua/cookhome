import { useTranslations } from "use-intl";

import { Alert } from "@repo/ui/alert";
import { Box } from "@repo/ui/box";
import { Button } from "@repo/ui/button";
import { SelectField } from "@repo/ui/select-field";
import { Stack } from "@repo/ui/stack";
import { Tag } from "@repo/ui/tag";
import { Typography } from "@repo/ui/typography";

import type { WorkflowError } from "@/lib/workflow/workflow-errors";

import type { CatalogForm } from "./useDesignerCatalog";

export interface DesignerToolbarProps {
  revision: number;
  isDirty: boolean;
  isSaving: boolean;
  isEditable: boolean;
  error: WorkflowError | null;
  onSave: () => void;
  onReload: () => void;
  onAppendStep: () => void;
  forms: readonly CatalogForm[];
  checkFormKey: string | null;
  onCheckFormKeyChange: (formKey: string | null) => void;
}

const NONE = "";

/**
 * 設計器頂列:草稿修訂號、未存標示、「檢查用表單」(跳過條件的欄位選項與檢查都對它的目前版本)、
 * 在最後加一關、存草稿。存草稿遇到 `CONFLICT`(別人先存過)→ 提示並提供「重新載入」。
 */
export const DesignerToolbar = ({
  revision,
  isDirty,
  isSaving,
  isEditable,
  error,
  onSave,
  onReload,
  onAppendStep,
  forms,
  checkFormKey,
  onCheckFormKeyChange,
}: DesignerToolbarProps) => {
  const t = useTranslations("admin.workflows.designer");
  const tErrors = useTranslations("admin.workflows.errors");
  const isConflict =
    error?.code === "CONFLICT" || error?.code === "DRAFT_REVISION_MISMATCH";

  return (
    <Stack spacing={1}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}
      >
        <Typography variant="body2" color="text.secondary">
          {t("revision", { revision })}
        </Typography>
        {isDirty && <Tag tone="warning" label={t("dirty")} />}
        <SelectField
          label={t("checkForm")}
          value={checkFormKey ?? NONE}
          displayEmpty
          size="small"
          sx={{ width: 220 }}
          helperText={t("checkFormHint")}
          options={[
            { value: NONE, label: t("checkFormNone") },
            ...forms.map((form) => ({ value: form.key, label: form.name })),
            // 預設值取自綁定表單,可能比表單目錄先到:目錄還沒載到時先列出目前值(否則下拉是空值、MUI 警告)
            ...(checkFormKey === null ||
            forms.some((form) => form.key === checkFormKey)
              ? []
              : [{ value: checkFormKey, label: checkFormKey }]),
          ]}
          onChange={(next) => {
            onCheckFormKeyChange(next === NONE ? null : next);
          }}
        />
        <Box sx={{ flex: 1 }} />
        {isEditable && (
          <Button variant="outlined" onClick={onAppendStep}>
            {t("appendStep")}
          </Button>
        )}
        {isEditable && (
          <Button disabled={!isDirty || isSaving} onClick={onSave}>
            {t("save")}
          </Button>
        )}
      </Stack>
      {error !== null && (
        <Alert
          severity="error"
          action={
            isConflict ? (
              <Button size="small" variant="text" onClick={onReload}>
                {t("reload")}
              </Button>
            ) : undefined
          }
        >
          {isConflict ? t("conflict") : tErrors(error.code)}
        </Alert>
      )}
    </Stack>
  );
};
