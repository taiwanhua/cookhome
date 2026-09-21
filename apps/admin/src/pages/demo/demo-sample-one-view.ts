import { DemoItemOneStatus } from "@repo/graphql";
import type { TagTone } from "@repo/ui/tag";

/**
 * 狀態 → 標籤色調(列表與詳情共用同一組,同一個狀態在兩頁不能是兩個顏色)。
 * 草稿是中性的灰、已發布是正面的綠、已封存用警示的黃(不是錯誤,只是「不再流通」)。
 */
const STATUS_TONES: Readonly<Record<DemoItemOneStatus, TagTone>> = {
  [DemoItemOneStatus.Draft]: "grey",
  [DemoItemOneStatus.Published]: "success",
  [DemoItemOneStatus.Archived]: "warning",
};

export const statusToneOf = (status: DemoItemOneStatus): TagTone =>
  STATUS_TONES[status];

const pad = (value: number): string => String(value).padStart(2, "0");

/**
 * 時間戳 → 「2026-09-10 14:22」(Figma 177:612 的變更歷程)。
 *
 * 刻意不走 `use-intl` 的 `useFormatter().dateTime`:`IntlProvider` 沒有給 `timeZone`,
 * 那條路會退回執行環境的時區並印一行警告。這裡就是要顯示**瀏覽器當地時間**,
 * 所以直接用 `Date` 的本地 getter,格式固定不隨語言變(歷程是稽核性質的資料,格式一致比在地化重要)。
 */
export const formatDateTime = (iso: string): string => {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) {
    return iso;
  }
  const date = `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  return `${date} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
};

/**
 * 審計動作 `demo-item-one.edit` → i18n 的 key `edit`。
 * 動作字串的正本是 api 的審計紀錄(模組文件「審計」),前綴是 targetType、最後一段才是動作。
 */
export const historyActionKeyOf = (action: string): string =>
  action.slice(action.lastIndexOf(".") + 1);

/** 這次改了哪些欄位(`after` 只放有變的欄位;不是物件就當作沒有可列的欄位)。 */
export const changedFieldsOf = (
  after: Record<string, unknown> | null | undefined,
): readonly string[] =>
  after === null || after === undefined ? [] : Object.keys(after);
