import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { IntlProvider } from "use-intl";

import { messages } from "@repo/i18n";
import { AppThemeProvider } from "@repo/ui/app-theme-provider";
import { cookhomeBrand } from "@repo/ui/theme";

import type { AuthSession } from "@/lib/auth/session";
import { useLocaleStore } from "@/stores/useLocaleStore";

import { SessionProvider } from "./SessionProvider";

export interface AppProvidersProps {
  session: AuthSession;
  queryClient: QueryClient;
  children: ReactNode;
}

/**
 * 全 app 共用的 providers(main.tsx 與測試共用同一份組裝;router 由外層提供)。
 * 全部是注入用(REACT-02):語言狀態本體在 `useLocaleStore`,這裡只把它餵給 IntlProvider 並同步 `<html lang>`。
 */
export const AppProviders = ({
  session,
  queryClient,
  children,
}: AppProvidersProps) => {
  const locale = useLocaleStore((state) => state.locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <IntlProvider locale={locale} messages={messages[locale]}>
      <AppThemeProvider brand={cookhomeBrand}>
        <QueryClientProvider client={queryClient}>
          <SessionProvider session={session}>{children}</SessionProvider>
        </QueryClientProvider>
      </AppThemeProvider>
    </IntlProvider>
  );
};
