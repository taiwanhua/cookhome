import { QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrowserRouter } from "react-router";

import { type Locale, defaultLocale, isLocale } from "@repo/i18n";

import { type AuthSession, createAuthSession } from "../lib/auth/session";
import { GRAPHQL_ENDPOINT } from "../lib/graphql";
import { AppProviders } from "./providers";
import { AppRoutes } from "./routes";

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

/** 組裝根:瀏覽器 router + 單一 session(access token 只活在這個物件的記憶體裡)+ providers。 */
function Root() {
  const [locale] = useState<Locale>(readStoredLocale);
  const [session] = useState<AuthSession>(() =>
    createAuthSession(GRAPHQL_ENDPOINT),
  );
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <BrowserRouter>
      <AppProviders session={session} queryClient={queryClient} locale={locale}>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  );
}

export default Root;
