import { GraphQLClient } from "graphql-request";

export * from "./generated";
export { GraphQLClient };

export function createGraphQLClient(
  url: string,
  headers?: Record<string, string>,
): GraphQLClient {
  return new GraphQLClient(url, { headers });
}
