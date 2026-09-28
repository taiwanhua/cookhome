"use client";

import { useColorScheme } from "@mui/material/styles";

/** 外觀:跟隨系統 / 亮 / 暗。 */
export type ColorMode = "system" | "light" | "dark";

export const COLOR_MODES: readonly ColorMode[] = ["system", "light", "dark"];

export interface ColorModeState {
  /** 目前選的外觀;還沒選過 = `system`(跟隨系統) */
  mode: ColorMode;
  /** 換外觀;`AppThemeProvider` 把選擇存進 localStorage(key 見它的 `modeStorageKey`) */
  setMode: (mode: ColorMode) => void;
}

/**
 * 外觀切換(STYLE-05:apps 不直接碰 MUI 的 `useColorScheme`)。主題已開 `cssVariables` + light / dark
 * `colorSchemes`,換外觀只是換 `<html>` 上的 class,元件照用語意 token 就自動正確(STYLE-04)。
 * 要在 `AppThemeProvider` 底下用。
 */
export const useColorMode = (): ColorModeState => {
  const { mode, setMode } = useColorScheme();
  return {
    mode: mode ?? "system",
    setMode: (next) => {
      setMode(next);
    },
  };
};
