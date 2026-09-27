import { useTranslations } from "use-intl";

import type { FieldDef } from "@repo/domain/form";
import {
  APPROVAL_MODES,
  type ApprovalMode,
  type ReviewStepDef,
} from "@repo/domain/workflow";
import { Button } from "@repo/ui/button";
import { FormControlLabel } from "@repo/ui/form-control-label";
import { SelectField } from "@repo/ui/select-field";
import { Stack } from "@repo/ui/stack";
import { Switch } from "@repo/ui/switch";
import { TextField } from "@repo/ui/text-field";
import { Typography } from "@repo/ui/typography";

import { ExpressionPicker } from "@/components/form-engine/ExpressionPicker/ExpressionPicker";
import type { DropTarget } from "@/lib/workflow/flow-ops";

import { AssigneeSourcePicker } from "./AssigneeSourcePicker";
import type { CatalogForm, CatalogRole } from "./useDesignerCatalog";

export interface MoveOption {
  value: string;
  label: string;
  target: DropTarget;
}

export interface StepEditorProps {
  step: ReviewStepDef;
  onChange: (next: ReviewStepDef) => void;
  /** 已發布過的關卡 key 不能改(實例、任務、歷程都靠它找回關卡) */
  isKeyLocked: boolean;
  isShared: boolean;
  forms: readonly CatalogForm[];
  roles: readonly CatalogRole[];
  /** 「檢查用表單」目前版本的欄位;跳過條件的欄位選項來自它 */
  checkFormFields: readonly FieldDef[] | null;
  /** 這一關的檢查器錯誤 / 警告 */
  issues: readonly string[];
  /** 主線上、還沒分流過的關卡才能「從此關分流」 */
  canFork: boolean;
  /** 在分支裡的關卡可以「多加一條分支」 */
  canAddBranch: boolean;
  moveOptions: readonly MoveOption[];
  onInsertAfter: () => void;
  onFork: () => void;
  onAddBranch: () => void;
  onShift: (delta: -1 | 1) => void;
  onMove: (target: DropTarget) => void;
  onDelete: () => void;
}

/**
 * 審核關卡的屬性面板(Spec 6b §8 零件 `<StepEditor>`):名稱、key、審核者來源(四種)、會簽、
 * 跳過條件(6a 表達式選擇器,欄位來自「檢查用表單」)、允許退回;以及加關卡 / 從此關分流 / 移動 / 刪除。
 * 移動也有按鈕版(上移、下移、移到某條分支),拖拉之外鍵盤也做得到。
 */
export const StepEditor = ({
  step,
  onChange,
  isKeyLocked,
  isShared,
  forms,
  roles,
  checkFormFields,
  issues,
  canFork,
  canAddBranch,
  moveOptions,
  onInsertAfter,
  onFork,
  onAddBranch,
  onShift,
  onMove,
  onDelete,
}: StepEditorProps) => {
  const t = useTranslations("admin.workflows.step");

  return (
    <Stack
      spacing={2}
      component="section"
      aria-label={t("region", { name: step.name })}
    >
      <Typography variant="subtitle1" component="h2">
        {t("title")}
      </Typography>
      <TextField
        label={t("name")}
        value={step.name}
        size="small"
        onChange={(event) => {
          onChange({ ...step, name: event.target.value });
        }}
      />
      <TextField
        label={t("key")}
        value={step.key}
        size="small"
        disabled={isKeyLocked}
        helperText={isKeyLocked ? t("keyLocked") : t("keyHint")}
        onChange={(event) => {
          onChange({ ...step, key: event.target.value });
        }}
      />
      <AssigneeSourcePicker
        value={step.assignee}
        onChange={(assignee) => {
          onChange({ ...step, assignee });
        }}
        isShared={isShared}
        forms={forms}
        roles={roles}
        isDisabled={false}
      />
      <SelectField<ApprovalMode>
        label={t("mode")}
        value={step.mode}
        size="small"
        helperText={t(`modeHints.${step.mode}`)}
        options={APPROVAL_MODES.map((mode) => ({
          value: mode,
          label: t(`modes.${mode}`),
        }))}
        onChange={(mode) => {
          onChange({ ...step, mode });
        }}
      />
      <FormControlLabel
        label={t("allowReturn")}
        control={
          <Switch
            checked={step.allowReturn !== false}
            onChange={(_event, allowReturn) => {
              onChange({ ...step, allowReturn });
            }}
          />
        }
      />
      {checkFormFields === null && (
        <Typography variant="caption" color="text.secondary">
          {t("skipNeedsCheckForm")}
        </Typography>
      )}
      <ExpressionPicker
        label={t("skipWhen")}
        value={step.skipWhen ?? undefined}
        fields={checkFormFields ?? []}
        onChange={(skipWhen) => {
          onChange({ ...step, skipWhen });
        }}
      />
      {issues.map((message) => (
        <Typography key={message} variant="caption" color="error">
          {message}
        </Typography>
      ))}
      <Stack spacing={1} role="group" aria-label={t("actions")}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
          <Button size="small" variant="outlined" onClick={onInsertAfter}>
            {t("insertAfter")}
          </Button>
          {canFork && (
            <Button size="small" variant="outlined" onClick={onFork}>
              {t("fork")}
            </Button>
          )}
          {canAddBranch && (
            <Button size="small" variant="outlined" onClick={onAddBranch}>
              {t("addBranch")}
            </Button>
          )}
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
          <Button
            size="small"
            variant="text"
            onClick={() => {
              onShift(-1);
            }}
          >
            {t("moveUp")}
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() => {
              onShift(1);
            }}
          >
            {t("moveDown")}
          </Button>
          <Button size="small" variant="text" color="error" onClick={onDelete}>
            {t("delete")}
          </Button>
        </Stack>
        {moveOptions.length > 0 && (
          <SelectField
            label={t("moveTo")}
            value=""
            displayEmpty
            size="small"
            options={[
              { value: "", label: t("moveToPlaceholder") },
              ...moveOptions.map((option) => ({
                value: option.value,
                label: option.label,
              })),
            ]}
            onChange={(value) => {
              const option = moveOptions.find((item) => item.value === value);
              if (option !== undefined) {
                onMove(option.target);
              }
            }}
          />
        )}
      </Stack>
    </Stack>
  );
};
