import { defaultLocale, isLocale, messages, type Locale } from "@repo/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { IntlProvider } from "use-intl";

import App from "./index";

const queryClient = new QueryClient();
const LOCALE_STORAGE_KEY = "cookhome-admin-locale";

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored !== null && isLocale(stored)) {
      return stored;
    }
  } catch {
    // localStorage 不可用(隱私模式等)時退回預設語言
  }
  return defaultLocale;
}

function Root() {
  const [locale, setLocale] = useState<Locale>(readStoredLocale);

  const changeLocale = (next: Locale) => {
    setLocale(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // 存不進去就只影響下次開啟的預設值,忽略
    }
  };

  return (
    <IntlProvider locale={locale} messages={messages[locale]}>
      <QueryClientProvider client={queryClient}>
        <App locale={locale} onLocaleChange={changeLocale} />
      </QueryClientProvider>
    </IntlProvider>
  );
}

export default Root;
