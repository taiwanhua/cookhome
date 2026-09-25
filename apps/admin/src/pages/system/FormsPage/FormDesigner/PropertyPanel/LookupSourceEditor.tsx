import { useTranslations } from "use-intl";

import {
  FORM_SUBMISSION_PROVIDER,
  type LookupSourceDescriptor,
} from "@repo/domain/form";
import { SelectField } from "@repo/ui/select-field";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";

/**
 * lookup 來源描述的編輯(`options.source`、`reference.source`、`prefills[].source`;Spec 6a §5「lookup 來源」)。
 * provider 與可回的欄位以 api 的登錄表為準(`apps/api/src/forms/lookup-providers.ts`,
 * docs/modules/forms.md「lookup 登錄表」);這裡列出已登錄的三個,欄位不存在時檢查器報 `LOOKUP_UNKNOWN_FIELD`。
 */
const PROVIDER_FIELDS: Readonly<Partial<Record<string, readonly string[]>>> = {
  user: ["name", "account", "email"],
  org: ["name", "slug"],
};

export interface LookupSourceEditorProps {
  value: LookupSourceDescriptor;
  onChange: (value: LookupSourceDescriptor) => void;
  /** 帶入規則不需要值欄(`valueField` 只有選項用) */
  hasValueField: boolean;
}

export const LookupSourceEditor = ({
  value,
  onChange,
  hasValueField,
}: LookupSourceEditorProps) => {
  const t = useTranslations("admin.forms.lookupSource");
  const knownFields = PROVIDER_FIELDS[value.provider];
  const isSubmission = value.provider === FORM_SUBMISSION_PROVIDER;

  return (
    <Stack spacing={1.5}>
      <SelectField<string>
        label={t("provider")}
        value={value.provider}
        options={[
          { value: "user", label: t("providers.user") },
          { value: "org", label: t("providers.org") },
          {
            value: FORM_SUBMISSION_PROVIDER,
            label: t("providers.form_submission"),
          },
        ]}
        onChange={(provider) => {
          onChange({
            provider,
            labelField: PROVIDER_FIELDS[provider]?.[0] ?? "title",
          });
        }}
        size="small"
      />
      {isSubmission && (
        <TextField
          label={t("formKey")}
          value={value.formKey ?? ""}
          onChange={(event) => {
            onChange({ ...value, formKey: event.target.value });
          }}
          helperText={t("formKeyHint")}
          size="small"
        />
      )}
      {knownFields === undefined ? (
        <TextField
          label={t("labelField")}
          value={value.labelField}
          onChange={(event) => {
            onChange({ ...value, labelField: event.target.value });
          }}
          helperText={t("labelFieldHint")}
          size="small"
        />
      ) : (
        <SelectField
          label={t("labelField")}
          value={value.labelField}
          options={knownFields.map((field) => ({
            value: field,
            label: t(`fields.${field}`),
          }))}
          onChange={(labelField) => {
            onChange({ ...value, labelField });
          }}
          size="small"
        />
      )}
      {hasValueField && (
        <TextField
          label={t("valueField")}
          value={value.valueField ?? ""}
          placeholder="id"
          onChange={(event) => {
            const valueField = event.target.value.trim();
            const next = { ...value, valueField };
            if (valueField === "") {
              Reflect.deleteProperty(next, "valueField");
            }
            onChange(next);
          }}
          helperText={t("valueFieldHint")}
          size="small"
        />
      )}
    </Stack>
  );
};
