import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useMemo } from "react";
import { IntlProvider } from "use-intl";

import { type Locale, messages } from "@repo/i18n";
import { AppThemeProvider } from "@repo/ui/app-theme-provider";
import { cookhomeBrand } from "@repo/ui/theme";

import { SessionProvider } from "../features/auth/session-provider";
import type { AuthSession } from "../lib/auth/session";
import { LocaleContext } from "../lib/locale";

interface AppProvidersProps {
  session: AuthSession;
  queryClient: QueryClient;
  locale?: Locale;
  /** AppBar 語言切換器呼叫;不給就只讀(切換無效) */
  onLocaleChange?: (locale: Locale) => void;
  children: ReactNode;
}

function ignoreLocaleChange() {
  // 未接 onLocaleChange 時的預設:切換不生效
}

/** 全 app 共用的 providers(main.tsx 與測試共用同一份組裝;router 由外層提供)。 */
export function AppProviders({
  session,
  queryClient,
  locale = "zh-TW",
  onLocaleChange = ignoreLocaleChange,
  children,
}: Readonly<AppProvidersProps>) {
  const localeValue = useMemo(
    () => ({ locale, setLocale: onLocaleChange }),
    [locale, onLocaleChange],
  );

  return (
    <LocaleContext.Provider value={localeValue}>
      <IntlProvider locale={locale} messages={messages[locale]}>
        <AppThemeProvider brand={cookhomeBrand}>
          <QueryClientProvider client={queryClient}>
            <SessionProvider session={session}>{children}</SessionProvider>
          </QueryClientProvider>
        </AppThemeProvider>
      </IntlProvider>
    </LocaleContext.Provider>
  );
}
