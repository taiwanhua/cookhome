import { useTranslations } from "use-intl";

import { DEFAULT_TENANT_TIMEZONE } from "@repo/domain/form";
import { Autocomplete } from "@repo/ui/autocomplete";

import { timezoneOptionsOf } from "./timezone-options";

export interface TimezoneFieldProps {
  /** 目前選的時區(IANA 名稱);null = 沒設、使用預設時區 */
  value: string | null;
  onChange: (value: string | null) => void;
  /** 持 `system.org-manager.set-timezone` 才改得動;沒有時唯讀顯示目前值 */
  canSetTimezone: boolean;
  isDisabled: boolean;
}

/**
 * 編輯組織彈窗的「時區」欄:只出現在**根組織**與**租戶頂層**(api 只讓這兩種組織有自己的時區)。
 * 看得到編輯彈窗的人都看得到這一欄(時區影響整個組織的日期時間),持 `set-timezone` 才改得動,否則唯讀。
 * 選項是瀏覽器 `Intl.supportedValuesOf("timeZone")` 的完整 IANA 清單,輸入即過濾;沒設時說明會退回預設時區。
 */
export const TimezoneField = ({
  value,
  onChange,
  canSetTimezone,
  isDisabled,
}: TimezoneFieldProps) => {
  const t = useTranslations("admin.orgManager.form");
  const unset = t("timezoneUnset", { timezone: DEFAULT_TENANT_TIMEZONE });

  return (
    <Autocomplete<string>
      label={t("timezone")}
      options={timezoneOptionsOf(value)}
      value={value}
      getOptionLabel={(timezone) => timezone}
      onChange={onChange}
      placeholder={unset}
      noOptionsText={t("timezoneEmpty")}
      helperText={value === null ? unset : t("timezoneHint")}
      disabled={isDisabled || !canSetTimezone}
      fullWidth
    />
  );
};
