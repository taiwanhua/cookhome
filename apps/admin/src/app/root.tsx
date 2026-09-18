import { QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BrowserRouter } from "react-router";

import { type AuthSession, createAuthSession } from "../lib/auth/session";
import { GRAPHQL_ENDPOINT } from "../lib/graphql";
import { useStoredLocale } from "../lib/locale";
import { AppProviders } from "./providers";
import { AppRoutes } from "./routes";

/** 組裝根:瀏覽器 router + 單一 session(access token 只活在這個物件的記憶體裡)+ providers。 */
function Root() {
  const { locale, setLocale } = useStoredLocale();
  const [session] = useState<AuthSession>(() =>
    createAuthSession(GRAPHQL_ENDPOINT),
  );
  const [queryClient] = useState(() => new QueryClient());

  return (
    <BrowserRouter>
      <AppProviders
        session={session}
        queryClient={queryClient}
        locale={locale}
        onLocaleChange={setLocale}
      >
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  );
}

export default Root;
