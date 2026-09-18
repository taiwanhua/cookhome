import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";

import { AppProviders } from "../app/providers/AppProviders";
import { AppRoutes } from "../app/routes";
import type { AuthSession } from "../lib/auth/session";
import { LocationProbe } from "./location-probe";

export interface TestAppProps {
  path: string;
  session: AuthSession;
  queryClient: QueryClient;
  extra?: ReactNode;
}

/** 與 App.tsx 相同組裝,只把 BrowserRouter 換成 MemoryRouter、多掛探針。 */
export const TestApp = ({
  path,
  session,
  queryClient,
  extra,
}: TestAppProps) => (
  <MemoryRouter initialEntries={[path]}>
    <AppProviders session={session} queryClient={queryClient}>
      <AppRoutes />
      {extra}
      <LocationProbe />
    </AppProviders>
  </MemoryRouter>
);
