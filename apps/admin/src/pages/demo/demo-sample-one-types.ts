import type {
  DemoItemOneHistoryQuery,
  DemoItemOneQuery,
  DemoItemsOneQuery,
} from "@repo/graphql";

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
export interface DemoCategoryOption {
  value: string;
  label: string;
}

/**
 * 內部備註欄在表單上的三態(模組文件「權限表」的欄位級權限示範)。
 * - `hidden`:沒有 `show-internal-note` → **整欄不顯示**,也絕不把這個欄位放進 input
 * - `readonly`:看得到、改不動(api 的 `abilities.canEditInternalNote` 為 false)
 * - `editable`:可改
 */
export type InternalNoteMode = "hidden" | "readonly" | "editable";
