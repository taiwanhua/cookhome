import type { ReportDefinition } from "@/lib/base/reports/report-registry";

/**
 * 專案登記的報表(底座「輸出報表」頁的登記清單;`docs/modules/reports.md`「報表登記介面」)。
 * 專案用 `registerReport({...})` 宣告報表後加進這裡,權限 `reports.<報表 key>` 要先在專案 seed 宣告。
 * 清單順序 = 報表選單的順序(排在底座登記的後面)。只追加自己的登記;底座版為空。
 */
export const projectReports: readonly ReportDefinition[] = [];
