import { graphql } from "msw";
import { setupServer } from "msw/node";

/** 測試用的 GraphQL 端點;AuthSession 與 handler 都對準它。 */
export const TEST_GRAPHQL_ENDPOINT = "https://api.test/graphql";

/** 只攔測試端點的 GraphQL 操作(operationName 對應 packages/graphql 文件裡的操作名)。 */
export const api = graphql.link(TEST_GRAPHQL_ENDPOINT);

export const server = setupServer();
