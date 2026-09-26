import { useTranslations } from "use-intl";

import {
  FORM_SUBMISSION_PROVIDER,
  type LookupSourceDescriptor,
} from "@repo/domain/form";
import { FormControlLabel } from "@repo/ui/form-control-label";
import { SelectField } from "@repo/ui/select-field";
import { Stack } from "@repo/ui/stack";
import { Switch } from "@repo/ui/switch";
import { Typography } from "@repo/ui/typography";

import {
  type LookupFieldOption,
  defaultLabelFieldOf,
  useLookupFieldOptions,
  usePublishedForms,
} from "./useLookupCatalog";

export interface LookupSourceEditorProps {
  value: LookupSourceDescriptor;
  onChange: (value: LookupSourceDescriptor) => void;
  /** 值欄只在「選項來源 = lookup」出現(帶入規則、引用欄位不需要) */
  hasValueField: boolean;
}

const UNSET = "";

/** 目前的值不在清單裡(舊資料、目錄還在載入)時仍列出,SelectField 才顯示得出來。 */
const withCurrent = (
  options: readonly { value: string; label: string }[],
  current: string | undefined,
): { value: string; label: string }[] =>
  current === undefined ||
  current === UNSET ||
  options.some((option) => option.value === current)
    ? [...options]
    : [...options, { value: current, label: current }];

const choicesOf = (options: readonly LookupFieldOption[]) =>
  options.map(({ value, label }) => ({ value, label }));

/** 固定條件:使用者 / 組織「只列啟用中的」(`filter.enabled`);表單提交「只列已完成的」(`completedOnly`,預設是)。 */
const isFixedFilterOn = (value: LookupSourceDescriptor): boolean =>
  value.provider === FORM_SUBMISSION_PROVIDER
    ? value.completedOnly !== false
    : value.filter?.enabled === true;

const withFixedFilter = (
  value: LookupSourceDescriptor,
  isOn: boolean,
): LookupSourceDescriptor => {
  if (value.provider === FORM_SUBMISSION_PROVIDER) {
    return { ...value, completedOnly: isOn };
  }
  const next = { ...value };
  if (isOn) {
    next.filter = { ...value.filter, enabled: true };
  } else {
    Reflect.deleteProperty(next, "filter");
  }
  return next;
};

/**
 * lookup 來源描述的編輯(`options.source`、`reference.source`、`prefills[].source`;Spec 6a §5「lookup 來源」)。
 * 照填表時的順序排:來源 → 表單(只有表單提交)→ 顯示欄 → 固定條件(選填)→ 值欄(只有選項來源);
 * 每一格中文標籤 + 一句說明,**全部用下拉選**(表單只列本租戶看得到且有已發布版本的,欄位從該表單目前版本挑,
 * `useLookupCatalog.ts`)。provider 以 api 的登錄表為準(`apps/api/src/forms/lookup-providers.ts`)。
 */
export const LookupSourceEditor = ({
  value,
  onChange,
  hasValueField,
}: LookupSourceEditorProps) => {
  const t = useTranslations("admin.forms.lookupSource");
  const isSubmission = value.provider === FORM_SUBMISSION_PROVIDER;
  const forms = usePublishedForms(isSubmission);
  const fieldOptions = useLookupFieldOptions(value);
  const isPending = fieldOptions === null;

  return (
    <Stack spacing={1.5}>
      <SelectField<string>
        label={t("provider")}
        value={value.provider}
        helperText={t("providerHint")}
        options={[
          { value: "user", label: t("providers.user") },
          { value: "org", label: t("providers.org") },
          {
            value: FORM_SUBMISSION_PROVIDER,
            label: t("providers.form_submission"),
          },
        ]}
        onChange={(provider) => {
          onChange({ provider, labelField: defaultLabelFieldOf(provider) });
        }}
        size="small"
      />
      {isSubmission && (
        <SelectField<string>
          label={t("form")}
          value={value.formKey ?? UNSET}
          displayEmpty
          helperText={t("formHint")}
          options={[
            { value: UNSET, label: t("formUnset") },
            ...withCurrent(
              forms.map((form) => ({
                value: form.key,
                label: `${form.name}(${form.key})`,
              })),
              value.formKey,
            ),
          ]}
          onChange={(formKey) => {
            // 換表單:顯示欄回到摘要槽「標題」(每版必填,一定挑得到)
            onChange({ ...value, formKey, labelField: "title" });
          }}
          size="small"
        />
      )}
      <SelectField<string>
        label={t("labelField")}
        value={isPending ? UNSET : value.labelField}
        displayEmpty
        disabled={isPending}
        helperText={isPending ? t("labelFieldPending") : t("labelFieldHint")}
        options={
          isPending
            ? [{ value: UNSET, label: t("labelFieldPending") }]
            : withCurrent(choicesOf(fieldOptions), value.labelField)
        }
        onChange={(labelField) => {
          onChange({ ...value, labelField });
        }}
        size="small"
      />
      <Stack spacing={0.25}>
        <Typography variant="body2">{t("fixedFilter")}</Typography>
        <FormControlLabel
          label={isSubmission ? t("completedOnly") : t("enabledOnly")}
          control={
            <Switch
              checked={isFixedFilterOn(value)}
              onChange={(_event, checked) => {
                onChange(withFixedFilter(value, checked));
              }}
            />
          }
        />
        <Typography variant="caption" color="text.secondary">
          {t("fixedFilterHint")}
        </Typography>
      </Stack>
      {hasValueField && (
        <SelectField<string>
          label={t("valueField")}
          value={value.valueField ?? UNSET}
          displayEmpty
          helperText={t("valueFieldHint")}
          options={[
            { value: UNSET, label: t("valueFieldId") },
            ...withCurrent(choicesOf(fieldOptions ?? []), value.valueField),
          ]}
          onChange={(valueField) => {
            const next = { ...value, valueField };
            if (valueField === UNSET) {
              Reflect.deleteProperty(next, "valueField");
            }
            onChange(next);
          }}
          size="small"
        />
      )}
    </Stack>
  );
};
