import { useTranslations } from "use-intl";

import { MenuItem } from "@repo/ui/menu";
import { Select } from "@repo/ui/select";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";

import type { UserFormState, UserFormValues } from "./useUserForm";

/** 性別的可選值(識別符英文、畫面文案走 i18n;api 的 `gender` 是自由字串)。 */
const GENDERS = ["male", "female", "other"] as const;

export interface UserBasicFieldsProps {
  form: UserFormState;
  /** 身分證欄可見(`show-national-id`);沒有就整欄不出現 */
  canShowNationalId: boolean;
  /** 身分證欄可改(`edit-national-id`);只可見不可改時唯讀 */
  canEditNationalId: boolean;
  isDisabled: boolean;
}

/**
 * 基本欄位兩欄式版面(Figma 202:731 起):帳號 / 姓名、暱稱 / 性別、Email / 電話、地址 / 身分證。
 * 身分證是欄位級權限(ADR-0007):無 `show-national-id` 連欄位都不渲染,
 * 有看沒有改(`edit-national-id`)時唯讀。
 */
export const UserBasicFields = ({
  form,
  canShowNationalId,
  canEditNationalId,
  isDisabled,
}: UserBasicFieldsProps) => {
  const t = useTranslations("admin.userManager.form");

  const field = (key: keyof UserFormValues, isRequired = false) => ({
    label: t(key),
    value: form.values[key],
    required: isRequired,
    fullWidth: true,
    disabled: isDisabled,
    onChange: (event: { target: { value: string } }) => {
      form.setValue(key, event.target.value);
    },
  });

  return (
    <Stack spacing={2.25}>
      <Stack direction="row" spacing={2}>
        <TextField {...field("account", true)} />
        <TextField {...field("name", true)} />
      </Stack>
      <Stack direction="row" spacing={2}>
        <TextField {...field("nickname")} />
        <Select
          value={form.values.gender}
          displayEmpty
          fullWidth
          disabled={isDisabled}
          aria-label={t("gender")}
          onChange={(event) => {
            form.setValue("gender", event.target.value);
          }}
        >
          <MenuItem value="">{t("genderOptions.unset")}</MenuItem>
          {GENDERS.map((gender) => (
            <MenuItem key={gender} value={gender}>
              {t(`genderOptions.${gender}`)}
            </MenuItem>
          ))}
        </Select>
      </Stack>
      <Stack direction="row" spacing={2}>
        <TextField {...field("email", true)} type="email" />
        <TextField {...field("phone")} />
      </Stack>
      <Stack direction="row" spacing={2}>
        <TextField {...field("address")} />
        {canShowNationalId && (
          <TextField
            {...field("nationalId")}
            disabled={isDisabled || !canEditNationalId}
          />
        )}
      </Stack>
    </Stack>
  );
};
