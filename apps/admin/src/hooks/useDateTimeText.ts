import { useFormatter } from "use-intl";

/**
 * ISO 時間 → 依目前語系格式化的日期時間(`use-intl` 的 `useFormatter`,不自己拼字串)。
 * `IntlProvider` 沒有設定全域時區,所以這裡明給時區,use-intl 才不會報 ENVIRONMENT_FALLBACK:
 * 呼叫端給了(表單的日期時間欄 = 租戶時區 / 那次修訂的時區)就用它,否則用瀏覽器時區。
 */
export const useDateTimeText = (): ((
  iso: string,
  timeZone?: string,
) => string) => {
  const format = useFormatter();
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (iso, timeZone = browserTimeZone) => {
    const at = new Date(iso);
    return Number.isNaN(at.getTime())
      ? iso
      : format.dateTime(at, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone,
        });
  };
};
