import { createGraphQLClient } from "@repo/graphql";

export const GRAPHQL_ENDPOINT =
  (import.meta.env.VITE_GRAPHQL_ENDPOINT as string | undefined) ??
  "http://localhost:5001/graphql";

export const graphqlClient = createGraphQLClient(GRAPHQL_ENDPOINT);
