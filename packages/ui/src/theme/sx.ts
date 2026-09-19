import type { SxProps, Theme } from "@mui/material/styles";

/** `sx` 陣列語法的單一項目(把 `SxProps` 的陣列分支排除掉)。 */
type SxEntry = Exclude<SxProps<Theme>, readonly unknown[]>;

/**
 * 包裝層的預設樣式與呼叫端傳入的 `sx` 疊加(MUI 的陣列語法),而不是被覆蓋。
 * 不用這個而直接 `sx={...} {...props}` 的話,呼叫端只要傳 `sx` 就會把包裝層樣式整包蓋掉。
 * 本檔刻意不從 `theme/index.ts` 匯出 — 它是 ui 內部用的,不是設計系統對外的 API。
 */
export const mergeSx = (
  base: SxEntry,
  incoming: SxProps<Theme> | undefined,
): SxProps<Theme> =>
  incoming === undefined ? base : [base, ...[incoming].flat()];
