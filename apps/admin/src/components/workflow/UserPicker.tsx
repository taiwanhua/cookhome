import { useTranslations } from "use-intl";

import { Autocomplete } from "@repo/ui/autocomplete";

import { type UserCandidate, useUserCandidates } from "./useUserCandidates";

export interface UserPickerProps {
  label: string;
  value: UserCandidate | null;
  onChange: (user: UserCandidate | null) => void;
  /** 不能選的人(申請人自己、已在本關的人);列出來但灰掉並寫原因 */
  disabledReasonOf?: (user: UserCandidate) => string | null;
  helperText?: string;
}

/**
 * 選一位本租戶使用者(改派 / 新增審核者):關鍵字丟回 api 查;停用的人列出但不能選。
 */
export const UserPicker = ({
  label,
  value,
  onChange,
  disabledReasonOf,
  helperText,
}: UserPickerProps) => {
  const t = useTranslations("admin.workflows.userPicker");
  const users = useUserCandidates();
  const reasonOf = (user: UserCandidate): string | null =>
    user.enabled ? (disabledReasonOf?.(user) ?? null) : t("disabled");
  const options =
    value === null || users.candidates.some((user) => user.id === value.id)
      ? users.candidates
      : [value, ...users.candidates];

  return (
    <Autocomplete<UserCandidate>
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      fullWidth
      size="small"
      loading={users.isFetching}
      loadingText={t("loading")}
      noOptionsText={users.isForbidden ? t("forbidden") : t("empty")}
      helperText={helperText}
      getOptionKey={(user) => user.id}
      getOptionLabel={(user) =>
        t("option", { name: user.name, account: user.account })
      }
      getOptionDisabled={(user) => reasonOf(user) !== null}
      getOptionDisabledReason={(user) => reasonOf(user)}
      onInputChange={users.setKeyword}
    />
  );
};
