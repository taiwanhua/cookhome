"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { type ReactNode, useMemo } from "react";

import { type Brand, createAppTheme } from "../theme";

export interface AppThemeProviderProps {
  brand: Brand;
  children: ReactNode;
  /**
   * 外觀(`useColorMode`)存在 localStorage 的 key;不給 = MUI 預設 `mui-mode`。
   * key 帶品牌 slug,由 app 決定並登記在 `docs/branding.md`。
   */
  modeStorageKey?: string;
  /** MUI 另記亮 / 暗各自用哪組配色的 key 前綴(`<前綴>-light` / `-dark`);不給 = `mui-color-scheme` */
  colorSchemeStorageKey?: string;
}

/**
 * apps 的 theme 入口(STYLE-05:apps 不直接 import MUI):
 * 由品牌設定建 theme,套 ThemeProvider + CssBaseline。
 * 外觀預設跟隨系統(`defaultMode` = `system`),使用者選過就記在 localStorage(`useColorMode`)。
 */
export const AppThemeProvider = ({
  brand,
  children,
  modeStorageKey,
  colorSchemeStorageKey,
}: AppThemeProviderProps) => {
  const theme = useMemo(() => createAppTheme(brand), [brand]);
  return (
    <ThemeProvider
      theme={theme}
      defaultMode="system"
      modeStorageKey={modeStorageKey}
      colorSchemeStorageKey={colorSchemeStorageKey}
    >
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};
