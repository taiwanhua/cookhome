"use client";

import { type Breakpoint, useTheme } from "@mui/material/styles";
import useMuiMediaQuery from "@mui/material/useMediaQuery";

/**
 * 畫面寬度是否**小於**某個 theme 斷點(STYLE-03:響應式只用 theme 斷點;STYLE-05:apps 不直接碰 MUI)。
 * 版面切換放不進 `sx` 斷點物件時用它 —— 例:表單引擎的明細列在手機寬(< `sm`)由表格改成每列一張卡片。
 *
 * 瀏覽器沒有 `matchMedia`(SSR、jsdom 沒有替身時)一律回 false(= 桌機版面)。
 */
export const useBreakpointDown = (breakpoint: Breakpoint): boolean => {
  const theme = useTheme();
  return useMuiMediaQuery(theme.breakpoints.down(breakpoint));
};
