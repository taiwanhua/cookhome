import {
  type GraphQLClient,
  createGraphQLClient,
  useRefreshMutation,
} from "@repo/graphql";

import { createAuthFetch } from "./auth-fetch";
import { authErrorCodeOf } from "./graphql-errors";
import { type SessionChannel, createSessionChannel } from "./session-channel";
import { type SessionStore, createSessionStore } from "./session-store";

export interface AuthSession {
  store: SessionStore;
  channel: SessionChannel;
  /** 公開端點用(login / refresh):不帶 access token、不攔截 */
  publicClient: GraphQLClient;
  /** 受保護端點用:自動帶 access token;TOKEN_EXPIRED 時靜默換票一次再重送 */
  client: GraphQLClient;
  /**
   * 以 refresh cookie 換一張新 access token(單飛:同一時間只發一次 `refresh`,其他呼叫等同一個結果;
   * api 的輪替是嚴格的 — 同一 refresh token 用兩次會被判成重放、作廢全部 session)。
   * 失敗即清狀態(status → anonymous)並拋出。
   */
  refresh: () => Promise<string>;
  /** 開機:記憶體沒 token 時用 cookie 換票;成功或失敗都會把 status 從 booting 移走 */
  restore: () => Promise<void>;
  /** 本分頁登出:清狀態並廣播給其他分頁(api 的 logout 由呼叫端先打) */
  signOut: () => void;
  /** 釋放 BroadcastChannel(卸載時) */
  dispose: () => void;
}

export function createAuthSession(endpoint: string): AuthSession {
  const store = createSessionStore();
  const channel = createSessionChannel();
  const publicClient = createGraphQLClient(endpoint, undefined, {
    credentials: "include",
  });

  let inflightRefresh: Promise<string> | null = null;

  const refresh = (): Promise<string> => {
    inflightRefresh ??= useRefreshMutation
      .fetcher(publicClient)()
      .then((result) => {
        store.setAccessToken(result.refresh.accessToken);
        return result.refresh.accessToken;
      })
      .catch((error: unknown) => {
        store.clear();
        throw error;
      })
      .finally(() => {
        inflightRefresh = null;
      });
    return inflightRefresh;
  };

  const restore = async () => {
    if (store.getSnapshot().status !== "booting") {
      return;
    }
    try {
      await refresh();
    } catch (error) {
      // 沒有可用的 refresh cookie(未登入 / 逾期 / 已登出)是正常路徑;其他錯誤(網路等)同樣視為未登入
      if (authErrorCodeOf(error) === null && !(error instanceof Error)) {
        throw error;
      }
    }
  };

  const client = createGraphQLClient(endpoint, undefined, {
    credentials: "include",
    fetch: createAuthFetch({ store, refresh }),
  });

  return {
    store,
    channel,
    publicClient,
    client,
    refresh,
    restore,
    signOut: () => {
      store.clear();
      channel.postLogout();
    },
    dispose: () => {
      channel.close();
    },
  };
}
