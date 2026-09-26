import { useTranslations } from "use-intl";

import { Button } from "@repo/ui/button";
import { SelectField } from "@repo/ui/select-field";
import { Stack } from "@repo/ui/stack";

import type { CatalogForm } from "./useDesignerCatalog";

export interface CheckFormFieldProps {
  forms: readonly CatalogForm[];
  value: string | null;
  onChange: (formKey: string | null) => void;
  /** 唯讀檢視舊版本:只顯示那一版存的檢查用表單,不能換 */
  isDisabled: boolean;
  onCheck: () => void;
  isChecking: boolean;
}

const NONE = "";

/**
 * 「檢查用表單」+「檢查」鈕(兩者放在一起:檢查的欄位類規則就是對這張表單驗)。
 * 檢查用表單是設計時對照用的:列出可選的欄位、驗證審核者欄位與跳過條件;實際送出以綁定的表單為準。
 * 隨草稿一起存(`workflow_versions.checkFormKey`),重新整理仍在。
 */
export const CheckFormField = ({
  forms,
  value,
  onChange,
  isDisabled,
  onCheck,
  isChecking,
}: CheckFormFieldProps) => {
  const t = useTranslations("admin.workflows.designer");

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "flex-start", flexWrap: "wrap", rowGap: 1 }}
    >
      <SelectField
        label={t("checkForm")}
        value={value ?? NONE}
        displayEmpty
        size="small"
        disabled={isDisabled}
        sx={{ width: 320 }}
        helperText={t("checkFormHint")}
        options={[
          { value: NONE, label: t("checkFormNone") },
          ...forms.map((form) => ({ value: form.key, label: form.name })),
          // 存的值可能比表單目錄先到(或已不在目錄裡):先列出目前值,否則下拉是空值、MUI 警告
          ...(value === null || forms.some((form) => form.key === value)
            ? []
            : [{ value, label: value }]),
        ]}
        onChange={(next) => {
          onChange(next === NONE ? null : next);
        }}
      />
      <Button
        variant="outlined"
        disabled={isChecking}
        onClick={onCheck}
        sx={{ mt: 0.25 }}
      >
        {isChecking ? t("checking") : t("check")}
      </Button>
    </Stack>
  );
};
