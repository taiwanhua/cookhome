/**
 * 原始設計 tokens(第一層)。
 * 元件不直接使用這裡的值 — 元件只認識 theme 的語意角色(第二層),
 * 這些值經由 create-theme.ts 組裝進 MUI theme。
 */

import { type BrandPalette, createPalette } from "./brand";

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

/** 語意狀態色(品牌無關,四組各五階;基準色取 Minimal 慣用值) */
export const statusPalettes: Record<
  "info" | "success" | "warning" | "error",
  BrandPalette
> = {
  // contrastText 由 createPalette 依 WCAG AA 自動挑白/深字
  info: createPalette("#00B8D9"),
  success: createPalette("#22C55E"),
  warning: createPalette("#FFAB00"),
  error: createPalette("#FF5630"),
};

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

const parseChannel = (slice: string): string =>
  String(Number.parseInt(slice, 16));

/** hex → "r, g, b"(rgba() 用) */
const toRgbChannels = (hex: string): string => {
  const value = hex.replace("#", "");
  return `${parseChannel(value.slice(0, 2))}, ${parseChannel(value.slice(2, 4))}, ${parseChannel(value.slice(4, 6))}`;
};

const shadowBase = toRgbChannels(grey[900]);

/** 單一 elevation 的柔和陰影 */
const softShadow = (elevation: number): string => {
  const spread = elevation >= 12 ? "-4" : "0";
  return `0 ${String(elevation)}px ${String(elevation * 2)}px ${spread}px rgba(${shadowBase}, 0.12)`;
};

/** MUI theme.shadows 的 25 階陣列(elevation 0~24) */
export const buildShadows = (): string[] => [
  "none",
  ...Array.from({ length: 24 }, (_, index) => softShadow(index + 1)),
];

export interface CustomShadows {
  z1: string;
  z4: string;
  z8: string;
  z12: string;
  z16: string;
  z20: string;
  z24: string;
  card: string;
  dropdown: string;
  dialog: string;
  primary: string;
  info: string;
  success: string;
  warning: string;
  error: string;
}

const colored = (hex: string): string =>
  `0 8px 16px 0 rgba(${toRgbChannels(hex)}, 0.24)`;

/** 同色系柔影(Minimal 立體感的關鍵):依品牌主色生成 */
export const createCustomShadows = (primaryMain: string): CustomShadows => {
  return {
    z1: softShadow(1),
    z4: softShadow(4),
    z8: softShadow(8),
    z12: softShadow(12),
    z16: softShadow(16),
    z20: softShadow(20),
    z24: softShadow(24),
    card: `0 1px 2px 0 rgba(${shadowBase}, 0.06), 0 12px 24px -4px rgba(${shadowBase}, 0.10)`,
    dropdown: `0 0 2px 0 rgba(${shadowBase}, 0.20), 0 12px 24px -4px rgba(${shadowBase}, 0.14)`,
    dialog: `0 8px 16px 0 rgba(${shadowBase}, 0.12), 0 24px 48px -8px rgba(${shadowBase}, 0.16)`,
    primary: colored(primaryMain),
    info: colored(statusPalettes.info.main),
    success: colored(statusPalettes.success.main),
    warning: colored(statusPalettes.warning.main),
    error: colored(statusPalettes.error.main),
  };
};
