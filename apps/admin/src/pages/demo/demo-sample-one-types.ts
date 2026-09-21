import type {
  DemoItemOneHistoryQuery,
  DemoItemOneQuery,
  DemoItemOneStatus,
  DemoItemsOneQuery,
} from "@repo/graphql";

import type { DemoFilterOption } from "./shared/demo-module-config";

/** 列表的一列(`demoItemsOne.items[]`)。 */
export type DemoItemRow = DemoItemsOneQuery["demoItemsOne"]["items"][number];

/**
 * 單筆(詳情頁與編輯頁共用)。與列表同一個 fragment,所以型別一致 ——
 * 差別只在列表是多筆、單筆看不到的資料一律 `NOT_FOUND`。
 */
export type DemoItemDetail = DemoItemOneQuery["demoItemOne"]["item"];

/** 變更歷程的一筆(編輯頁的區塊;`before` / `after` 只有有變的欄位)。 */
export type DemoItemHistoryEntry =
  DemoItemOneHistoryQuery["demoItemOneHistory"]["items"][number];

/** 分類下拉的一個選項(由欄位管理的 `fields(categoryId)` 轉來)。 */
export type DemoCategoryOption = DemoFilterOption;

/** 示範模組1 表單的文字 / 選擇類欄位(檔案欄由共用表單的 `FileSlot` 管)。 */
export interface SampleOneFormValues {
  name: string;
  category: DemoCategoryOption | null;
  status: DemoItemOneStatus;
  note: string;
  internalNote: string;
}
