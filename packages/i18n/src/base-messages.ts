import enAdmin from "../messages/en/admin.json" with { type: "json" };
import enCommon from "../messages/en/common.json" with { type: "json" };
import enFront from "../messages/en/front.json" with { type: "json" };
import zhAdmin from "../messages/zh-TW/admin.json" with { type: "json" };
import zhCommon from "../messages/zh-TW/common.json" with { type: "json" };
import zhFront from "../messages/zh-TW/front.json" with { type: "json" };
import type { Locale, defaultLocale } from "./locales";

/**
 * 基礎字典(唯一的組裝處)。`common.brand` 與 `front.meta` 是中性預設,
 * app 經 `composeProjectMessages` 注入專案值後才交給翻譯函式(I18N-06)。
 */
export const messages = {
  "zh-TW": { common: zhCommon, front: zhFront, admin: zhAdmin },
  en: { common: enCommon, front: enFront, admin: enAdmin },
} satisfies Record<Locale, Record<string, unknown>>;

export type Messages = (typeof messages)[typeof defaultLocale];
