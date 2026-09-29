/** 瀏覽器認得的完整 IANA 時區清單;第一次用到才取,之後重用同一份。 */
let supportedTimezones: readonly string[] | null = null;

const allTimezones = (): readonly string[] => {
  supportedTimezones ??= Intl.supportedValuesOf("timeZone");
  return supportedTimezones;
};

/**
 * 「時區」欄的選項:瀏覽器 `Intl.supportedValuesOf("timeZone")` 的完整清單(不自己列表、不裝套件)。
 * 目前存的值是 api 以 `isValidTimezone` 驗過的,但不一定是清單裡的正規名稱(如別名 `UTC`),
 * 這時把它放在最前面,免得已設的值在選單裡找不到。
 */
export const timezoneOptionsOf = (current: string | null): string[] => {
  const all = allTimezones();
  return current === null || all.includes(current)
    ? [...all]
    : [current, ...all];
};
