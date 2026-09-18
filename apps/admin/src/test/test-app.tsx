import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";

import { AppProviders } from "../app/providers";
import { AppRoutes } from "../app/routes";
import type { AuthSession } from "../lib/auth/session";
import { useStoredLocale } from "../lib/locale";
import { LocationProbe } from "./location-probe";

export interface TestAppProps {
  path: string;
  session: AuthSession;
  queryClient: QueryClient;
  extra?: ReactNode;
}

/** 與 root.tsx 相同組裝(語言狀態同一個 hook),只把 BrowserRouter 換成 MemoryRouter、多掛探針。 */
export function TestApp({
  path,
  session,
  queryClient,
  extra,
}: Readonly<TestAppProps>) {
  const { locale, setLocale } = useStoredLocale();
  return (
    <MemoryRouter initialEntries={[path]}>
      <AppProviders
        session={session}
        queryClient={queryClient}
        locale={locale}
        onLocaleChange={setLocale}
      >
        <AppRoutes />
        {extra}
        <LocationProbe />
      </AppProviders>
    </MemoryRouter>
  );
}
