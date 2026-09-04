import { defaultLocale, locales } from "@repo/i18n";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales,
  defaultLocale,
  // 預設語言(zh-TW)無前綴,其他語言帶前綴(/en/...)
  localePrefix: "as-needed",
});
