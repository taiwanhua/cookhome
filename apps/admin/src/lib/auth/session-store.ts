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
  /**
   * api 對某個受保護請求回了 `MUST_CHANGE_PASSWORD`(GQL-04;首登須改密碼者做了「看自己 / 改密碼 / 登出」以外的操作)。
   * 由 fetch 層寫入、路由守門讀取後導向改密碼頁;改完密碼清掉。
   */
  mustChangePassword: boolean;
}

export interface SessionStore {
  getSnapshot: () => SessionSnapshot;
  subscribe: (listener: () => void) => () => void;
  setAccessToken: (token: string) => void;
  setMustChangePassword: (value: boolean) => void;
  /** 清空 token 並標記為未登入(登出、refresh 失敗、其他分頁登出) */
  clear: () => void;
}

const ANONYMOUS: SessionSnapshot = {
  status: "anonymous",
  accessToken: null,
  mustChangePassword: false,
};

export function createSessionStore(): SessionStore {
  let snapshot: SessionSnapshot = {
    status: "booting",
    accessToken: null,
    mustChangePassword: false,
  };
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
      update({ ...snapshot, status: "authenticated", accessToken: token });
    },
    setMustChangePassword: (value) => {
      if (snapshot.mustChangePassword === value) {
        return;
      }
      update({ ...snapshot, mustChangePassword: value });
    },
    clear: () => {
      if (snapshot.status === "anonymous") {
        return;
      }
      update(ANONYMOUS);
    },
  };
}
