import { useFormatter } from "use-intl";

/**
 * ISO 時間 → 依目前語系格式化的日期時間(`use-intl` 的 `useFormatter`,不自己拼字串)。
 * `IntlProvider` 沒有設定全域時區,所以這裡明給瀏覽器時區,use-intl 才不會報 ENVIRONMENT_FALLBACK。
 */
export const useDateTimeText = (): ((iso: string) => string) => {
  const format = useFormatter();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (iso) => {
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
