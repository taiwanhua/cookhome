import { type Theme, createTheme } from "@mui/material/styles";

import type { Brand } from "./brand";
import { fontFamily, grey, radius, softShadows } from "./tokens";

export interface CreateAppThemeOptions {
  /**
   * CSS 變數前綴。預設 "mui"。
   * 需要在同一頁面掛第二份 theme 時(如 Palette Lab)換一個前綴避免衝突。
   */
  cssVarPrefix?: string;
}

/**
 * 由品牌設定產生 MUI theme(第二層:語意角色)。
 * - cssVariables 模式:切換品牌/深淺色不需重新 render,並與 Figma variables 一對一對應
 * - light / dark 兩組 colorSchemes 從第一天就建模
 */
export const createAppTheme = (
  brand: Brand,
  options: CreateAppThemeOptions = {},
): Theme => {
  const { cssVarPrefix = "mui" } = options;

  const primary = {
    light: brand.primary.light,
    main: brand.primary.main,
    dark: brand.primary.dark,
    contrastText: brand.primary.contrastText,
  };

  return createTheme({
    cssVariables: {
      cssVarPrefix,
      colorSchemeSelector: "class",
    },
    colorSchemes: {
      light: {
        palette: {
          primary,
          grey,
          background: { default: grey[100], paper: "#FFFFFF" },
          text: { primary: grey[800], secondary: grey[600] },
          divider: "rgba(147, 158, 169, 0.24)",
        },
      },
      dark: {
        palette: {
          primary,
          grey,
          background: { default: grey[900], paper: grey[800] },
          text: { primary: "#F7F9FA", secondary: grey[400] },
          divider: "rgba(147, 158, 169, 0.20)",
        },
      },
    },
    typography: {
      fontFamily,
      h1: { fontWeight: 800 },
      h2: { fontWeight: 800 },
      h3: { fontWeight: 700 },
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { fontWeight: 600 },
    },
    shape: { borderRadius: radius.sm },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            boxShadow: "none",
            "&:hover": { boxShadow: "none" },
          },
          sizeLarge: { height: 48 },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: radius.lg,
            boxShadow: softShadows.card,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: radius.sm },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: radius.lg,
            boxShadow: softShadows.dialog,
          },
        },
      },
    },
  });
};
