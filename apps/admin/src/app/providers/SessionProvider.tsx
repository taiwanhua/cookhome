import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";

import { SessionContext } from "@/hooks/useSession";
import type { AuthSession } from "@/lib/auth/session";
import { useSessionStore } from "@/stores/useSessionStore";

export interface SessionProviderProps {
  session: AuthSession;
  children: ReactNode;
}

/**
 * 登入狀態的 React 入口(注入 `AuthSession` 實例;狀態本體在 `useSessionStore`):
 * - 開機時用 refresh cookie 換票(重新整理後 30 天內不必重登)
 * - 監聽其他分頁的登出廣播
 * - 狀態變成未登入時清掉 react-query 快取(`me` 等不留給下一個人)
 */
export const SessionProvider = ({
  session,
  children,
}: SessionProviderProps) => {
  const queryClient = useQueryClient();
  const status = useSessionStore((state) => state.status);

  useEffect(() => {
    void session.restore();
  }, [session]);

  useEffect(
    () =>
      session.channel.onLogout(() => {
        session.store.getState().clear();
      }),
    [session],
  );

  useEffect(() => {
    if (status === "anonymous") {
      queryClient.clear();
    }
  }, [queryClient, status]);

  useEffect(
    () => () => {
      session.dispose();
    },
    [session],
  );

  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
};
