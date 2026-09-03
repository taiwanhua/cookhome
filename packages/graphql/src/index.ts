import { GraphQLClient } from "graphql-request";

export * from "./generated";
export { GraphQLClient } from "graphql-request";

export function createGraphQLClient(
  url: string,
  headers?: Record<string, string>,
): GraphQLClient {
  return new GraphQLClient(url, { headers });
}
