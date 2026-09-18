import { createContext } from "react";

import type { AuthSession } from "../../lib/auth/session";
import type { SessionSnapshot } from "../../lib/auth/session-store";

export interface SessionContextValue {
  session: AuthSession;
  snapshot: SessionSnapshot;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
