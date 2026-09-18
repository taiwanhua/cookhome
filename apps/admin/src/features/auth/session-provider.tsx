import { useQueryClient } from "@tanstack/react-query";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import type { AuthSession } from "../../lib/auth/session";
import { SessionContext } from "./session-context";

interface SessionProviderProps {
  session: AuthSession;
  children: ReactNode;
}

/**
 * 登入狀態的 React 入口:
 * - 開機時用 refresh cookie 換票(重新整理後 30 天內不必重登)
 * - 監聽其他分頁的登出廣播
 * - 狀態變成未登入時清掉 react-query 快取(`me` 等不留給下一個人)
 */
export function SessionProvider({
  session,
  children,
}: Readonly<SessionProviderProps>) {
  const queryClient = useQueryClient();
  const snapshot = useSyncExternalStore(
    session.store.subscribe,
    session.store.getSnapshot,
  );

  useEffect(() => {
    void session.restore();
  }, [session]);

  useEffect(
    () =>
      session.channel.onLogout(() => {
        session.store.clear();
      }),
    [session],
  );

  useEffect(() => {
    if (snapshot.status === "anonymous") {
      queryClient.clear();
    }
  }, [queryClient, snapshot.status]);

  useEffect(
    () => () => {
      session.dispose();
    },
    [session],
  );

  const value = useMemo(() => ({ session, snapshot }), [session, snapshot]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
