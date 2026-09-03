/**
 * 原始設計 tokens(第一層)。
 * 元件不直接使用這裡的值 — 元件只認識 theme 的語意角色(第二層),
 * 這些值經由 create-theme.ts 組裝進 MUI theme。
 */

/** 中性灰階(冷灰,Minimal 風格的底) */
export const grey = {
  50: "#FAFBFC",
  100: "#F7F9FA",
  200: "#F2F4F6",
  300: "#E0E4E8",
  400: "#C6CDD4",
  500: "#939EA9",
  600: "#64707C",
  700: "#46505A",
  800: "#222B35",
  900: "#151B22",
} as const;

/** 字型:Public Sans(使用端需自行載入 @fontsource-variable/public-sans) */
export const fontFamily = [
  '"Public Sans Variable"',
  '"Public Sans"',
  "-apple-system",
  "BlinkMacSystemFont",
  '"Segoe UI"',
  "Roboto",
  '"Noto Sans TC"',
  "sans-serif",
].join(",");

/** 圓角階層 */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

/** 柔和陰影(Minimal 風格的關鍵) */
export const softShadows = {
  card: "0 1px 2px 0 rgba(21, 27, 34, 0.06), 0 12px 24px -4px rgba(21, 27, 34, 0.10)",
  dialog:
    "0 8px 16px 0 rgba(21, 27, 34, 0.12), 0 24px 48px -8px rgba(21, 27, 34, 0.16)",
} as const;
