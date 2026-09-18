import { QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BrowserRouter } from "react-router";

import { type AuthSession, createAuthSession } from "../lib/auth/session";
import { GRAPHQL_ENDPOINT } from "../lib/graphql";
import { useSessionStore } from "../stores/useSessionStore";
import { AppProviders } from "./providers/AppProviders";
import { AppRoutes } from "./routes";

/** 組裝根:瀏覽器 router + 單一 session(access token 只活在 `useSessionStore` 的記憶體裡)+ providers。 */
export const App = () => {
  const [session] = useState<AuthSession>(() =>
    createAuthSession(GRAPHQL_ENDPOINT, useSessionStore),
  );
  const [queryClient] = useState(() => new QueryClient());

  return (
    <BrowserRouter>
      <AppProviders session={session} queryClient={queryClient}>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  );
};
