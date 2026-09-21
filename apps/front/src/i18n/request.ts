import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { messages } from "@repo/i18n";

import { routing } from "./routing";

// requestLocale 被標 deprecated,但官方建議的 next/root-params 在 Next 16.2 仍是
// 編譯期置換的佔位模組(型別為 any),等該 API 型別穩定後再遷移
// eslint-disable-next-line sonarjs/deprecation, @typescript-eslint/no-deprecated
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return { locale, messages: messages[locale] };
});
