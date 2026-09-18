import { GraphQLClient } from "graphql-request";

export * from "./generated";
export { ClientError, GraphQLClient } from "graphql-request";

export interface CreateGraphQLClientOptions {
  /** 自訂 fetch(例:admin 的登入攔截層 — 帶 access token、TOKEN_EXPIRED 時靜默換票重送) */
  fetch?: typeof fetch;
  /** refresh token 走 httpOnly cookie(ADR-0003),跨網域要帶 cookie 時設 `"include"` */
  credentials?: RequestCredentials;
}

export function createGraphQLClient(
  url: string,
  headers?: Record<string, string>,
  options: CreateGraphQLClientOptions = {},
): GraphQLClient {
  return new GraphQLClient(url, { headers, ...options });
}
