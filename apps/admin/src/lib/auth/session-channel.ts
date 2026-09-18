/** 分頁間的登出廣播(#61:分頁 A 登出 → 分頁 B 立即回登入頁)。 */
export const SESSION_CHANNEL_NAME = "cookhome-admin-session";

interface SessionMessage {
  type: "logout";
}

export interface SessionChannel {
  postLogout: () => void;
  onLogout: (listener: () => void) => () => void;
  close: () => void;
}

function isSessionMessage(value: unknown): value is SessionMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "logout"
  );
}

export function createSessionChannel(
  name = SESSION_CHANNEL_NAME,
): SessionChannel {
  const channel = new BroadcastChannel(name);
  const listeners = new Set<() => void>();

  channel.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (!isSessionMessage(event.data)) {
      return;
    }
    for (const listener of listeners) {
      listener();
    }
  });

  return {
    postLogout: () => {
      const message: SessionMessage = { type: "logout" };
      channel.postMessage(message);
    },
    onLogout: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close: () => {
      listeners.clear();
      channel.close();
    },
  };
}
