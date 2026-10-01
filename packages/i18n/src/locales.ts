export const locales = ["zh-TW", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "zh-TW";

/** 語言切換選單顯示用:各語言以「自己的語言」呈現自己 */
export const localeLabels: Record<Locale, string> = {
  "zh-TW": "繁體中文",
  en: "English",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
