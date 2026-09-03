/**
 * 品牌層:一個品牌 = 一份 Brand 設定,元件零修改即可整包替換。
 * 新品牌用 createBrandFromPrimary() 從單一主色推導,或手工微調各色階。
 */

export interface BrandPalette {
  lighter: string;
  light: string;
  main: string;
  dark: string;
  darker: string;
  contrastText: string;
}

export interface Brand {
  name: string;
  primary: BrandPalette;
}

const toRgb = (hex: string): [number, number, number] => {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
};

const toHexChannel = (n: number): string =>
  Math.round(n).toString(16).padStart(2, "0");

/** 兩色混合:weight 為 mixWith 的比例(0~1) */
export const mixHex = (
  color: string,
  mixWith: string,
  weight: number,
): string => {
  const [r1, g1, b1] = toRgb(color);
  const [r2, g2, b2] = toRgb(mixWith);
  const mix = (a: number, b: number): number => a * (1 - weight) + b * weight;
  return `#${toHexChannel(mix(r1, r2))}${toHexChannel(mix(g1, g2))}${toHexChannel(mix(b1, b2))}`.toUpperCase();
};

/** 從單一主色推導完整色階(lighter/light/dark/darker 以白/黑混合近似) */
export const createBrandFromPrimary = (
  name: string,
  primaryHex: string,
  contrastText = "#FFFFFF",
): Brand => ({
  name,
  primary: {
    lighter: mixHex(primaryHex, "#FFFFFF", 0.84),
    light: mixHex(primaryHex, "#FFFFFF", 0.48),
    main: primaryHex.toUpperCase(),
    dark: mixHex(primaryHex, "#000000", 0.24),
    darker: mixHex(primaryHex, "#000000", 0.52),
    contrastText,
  },
});
