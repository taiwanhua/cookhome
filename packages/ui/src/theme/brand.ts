/**
 * 品牌層:一個品牌 = 一份 Brand 設定,元件零修改即可整包替換。
 * 新品牌用 createBrandFromPrimary() 從單一主色推導,或以 overrides 逃生口手調任一階。
 * 混色在 OKLab 感知均勻色彩空間進行 — 極端色(高彩度、極暗)的色階比 RGB 混合自然。
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

interface Oklab {
  l: number;
  a: number;
  b: number;
}

const toRgb = (hex: string): [number, number, number] => {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  ];
};

const srgbToLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

const linearToSrgb = (c: number): number =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

const toOklab = (hex: string): Oklab => {
  const [r, g, b] = toRgb(hex).map((c) => srgbToLinear(c)) as [
    number,
    number,
    number,
  ];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
};

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

const toHexChannel = (linear: number): string =>
  Math.round(clamp01(linearToSrgb(clamp01(linear))) * 255)
    .toString(16)
    .padStart(2, "0");

const fromOklab = ({ l: okL, a: okA, b: okB }: Oklab): string => {
  const l = (okL + 0.3963377774 * okA + 0.2158037573 * okB) ** 3;
  const m = (okL - 0.1055613458 * okA - 0.0638541728 * okB) ** 3;
  const s = (okL - 0.0894841775 * okA - 1.291485548 * okB) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`.toUpperCase();
};

/** 兩色混合(OKLab 感知空間):weight 為 mixWith 的比例(0~1) */
export const mixHex = (
  color: string,
  mixWith: string,
  weight: number,
): string => {
  const c1 = toOklab(color);
  const c2 = toOklab(mixWith);
  const mix = (a: number, b: number): number => a * (1 - weight) + b * weight;
  return fromOklab({
    l: mix(c1.l, c2.l),
    a: mix(c1.a, c2.a),
    b: mix(c1.b, c2.b),
  });
};

export interface CreatePaletteOptions {
  contrastText?: string;
  /** 逃生口:演算法生成的某一階不滿意時,逐階手動覆寫 */
  overrides?: Partial<BrandPalette>;
}

/** 從單一基準色推導五階色盤(lighter/light/dark/darker 以白/黑在 OKLab 混合) */
export const createPalette = (
  baseHex: string,
  options: CreatePaletteOptions = {},
): BrandPalette => {
  const { contrastText = "#FFFFFF", overrides = {} } = options;
  return {
    lighter: mixHex(baseHex, "#FFFFFF", 0.84),
    light: mixHex(baseHex, "#FFFFFF", 0.48),
    main: baseHex.toUpperCase(),
    dark: mixHex(baseHex, "#000000", 0.24),
    darker: mixHex(baseHex, "#000000", 0.52),
    contrastText,
    ...overrides,
  };
};

/** 從單一主色推導品牌設定 */
export const createBrandFromPrimary = (
  name: string,
  primaryHex: string,
  options: CreatePaletteOptions = {},
): Brand => ({
  name,
  primary: createPalette(primaryHex, options),
});
