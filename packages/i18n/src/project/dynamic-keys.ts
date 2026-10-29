import type { DynamicKey } from "../usage-scan";

/**
 * 專案字典(`messages/<locale>/project/admin.json`)與專案程式的動態 key 白名單:死鍵測試
 * `dead-keys.test.ts` 與底座的白名單合在一起檢查(寫法、理由格式、「每條都要對得上字典」同一套)。
 * 底座的條目留在 `dead-keys.test.ts`,這份只放專案的;底座升級不覆寫這個檔:
 *
 * ```ts
 * {
 *   key: "admin.<專案區塊>.statuses.",
 *   reason: "列表狀態欄的 `t(`statuses.${status}`)`,status 是 api 回的值",
 * }
 * ```
 */
export const PROJECT_DYNAMIC_KEYS: readonly DynamicKey[] = [];
