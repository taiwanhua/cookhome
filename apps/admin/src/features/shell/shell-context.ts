import { useOutletContext } from "react-router";

import type { MeQuery } from "@repo/graphql";

/** 殼傳給子路由(首頁、模組路由)的資料:已載入的 `me`。 */
export interface ShellOutletContext {
  me: MeQuery["me"];
}

export function useShellOutlet(): ShellOutletContext {
  return useOutletContext<ShellOutletContext>();
}
