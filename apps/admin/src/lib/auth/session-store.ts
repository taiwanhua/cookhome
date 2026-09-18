/**
 * access token 的唯一存放處:記憶體(ADR-0003;不進 localStorage / cookie)。
 * 以 external store 形式提供給 React(`useSyncExternalStore`)與非 React 的 fetch 層共用。
 */
export type SessionStatus =
  /** 開機中:記憶體沒有 token,正在用 refresh cookie 換票 */
  "booting" | "authenticated" | "anonymous";

export interface SessionSnapshot {
  status: SessionStatus;
  accessToken: string | null;
}

export interface SessionStore {
  getSnapshot: () => SessionSnapshot;
  subscribe: (listener: () => void) => () => void;
  setAccessToken: (token: string) => void;
  /** 清空 token 並標記為未登入(登出、refresh 失敗、其他分頁登出) */
  clear: () => void;
}

export function createSessionStore(): SessionStore {
  let snapshot: SessionSnapshot = { status: "booting", accessToken: null };
  const listeners = new Set<() => void>();

  const update = (next: SessionSnapshot) => {
    snapshot = next;
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setAccessToken: (token) => {
      update({ status: "authenticated", accessToken: token });
    },
    clear: () => {
      if (snapshot.status === "anonymous") {
        return;
      }
      update({ status: "anonymous", accessToken: null });
    },
  };
}
