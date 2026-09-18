import enAdmin from "../messages/en/admin.json" with { type: "json" };
import enCommon from "../messages/en/common.json" with { type: "json" };
import enFront from "../messages/en/front.json" with { type: "json" };
import zhAdmin from "../messages/zh-TW/admin.json" with { type: "json" };
import zhCommon from "../messages/zh-TW/common.json" with { type: "json" };
import zhFront from "../messages/zh-TW/front.json" with { type: "json" };

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

export const messages = {
  "zh-TW": { common: zhCommon, front: zhFront, admin: zhAdmin },
  en: { common: enCommon, front: enFront, admin: enAdmin },
} satisfies Record<Locale, Record<string, unknown>>;

export type Messages = (typeof messages)[typeof defaultLocale];
