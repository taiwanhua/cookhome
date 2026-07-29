import { createGraphQLClient } from "@repo/graphql";

export const GRAPHQL_ENDPOINT =
  process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT ?? "http://localhost:5001/graphql";

export const graphqlClient = createGraphQLClient(GRAPHQL_ENDPOINT);
