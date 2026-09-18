"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { type ReactNode, useMemo } from "react";

import { type Brand, createAppTheme } from "../theme";

export interface AppThemeProviderProps {
  brand: Brand;
  children: ReactNode;
}

/**
 * apps 的 theme 入口(STYLE-05:apps 不直接 import MUI):
 * 由品牌設定建 theme,套 ThemeProvider + CssBaseline。
 */
export function AppThemeProvider({
  brand,
  children,
}: Readonly<AppThemeProviderProps>) {
  const theme = useMemo(() => createAppTheme(brand), [brand]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
