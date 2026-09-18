import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { IntlProvider } from "use-intl";

import { type Locale, messages } from "@repo/i18n";
import { AppThemeProvider } from "@repo/ui/app-theme-provider";
import { cookhomeBrand } from "@repo/ui/theme";

import { SessionProvider } from "../features/auth/session-provider";
import type { AuthSession } from "../lib/auth/session";

interface AppProvidersProps {
  session: AuthSession;
  queryClient: QueryClient;
  locale?: Locale;
  children: ReactNode;
}

/** 全 app 共用的 providers(main.tsx 與測試共用同一份組裝;router 由外層提供)。 */
export function AppProviders({
  session,
  queryClient,
  locale = "zh-TW",
  children,
}: Readonly<AppProvidersProps>) {
  return (
    <IntlProvider locale={locale} messages={messages[locale]}>
      <AppThemeProvider brand={cookhomeBrand}>
        <QueryClientProvider client={queryClient}>
          <SessionProvider session={session}>{children}</SessionProvider>
        </QueryClientProvider>
      </AppThemeProvider>
    </IntlProvider>
  );
}
