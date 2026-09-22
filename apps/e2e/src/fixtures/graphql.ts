import { GRAPHQL_ENDPOINT } from "../config";

/**
 * 前置資料一律走 api(TEST-11):UI 只負責跑「要驗的那一段」。
 *
 * 這裡刻意用原生 `fetch` 打 GraphQL,不引 `@repo/graphql` 的 codegen 產物 ——
 * 那份是 React Query 的 hooks(瀏覽器用),在 Node 的 harness 裡沒有對應的執行環境。
 */

export interface GraphqlErrorEntry {
  message: string;
  extensions?: { code?: string; reason?: string } & Record<string, unknown>;
}

export interface GraphqlResponse<T> {
  data: T | null;
  errors?: GraphqlErrorEntry[];
}

/** 打一次 GraphQL,錯誤原樣回傳(要驗 `FORBIDDEN` 這類回應時用)。 */
export async function graphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string,
): Promise<GraphqlResponse<T>> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ query, variables }),
  });
  return (await response.json()) as GraphqlResponse<T>;
}

/** 打一次 GraphQL,有錯就拋(前置資料用:前置失敗要當場炸,不要讓劇本紅在別的地方)。 */
export async function graphqlOk<T>(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string,
): Promise<T> {
  const result = await graphql<T>(query, variables, token);
  const head = query.trim().split("\n", 1)[0] ?? "";
  if (result.errors !== undefined && result.errors.length > 0) {
    const detail = result.errors
      .map(
        (error) => `${error.extensions?.code ?? "UNKNOWN"}: ${error.message}`,
      )
      .join("; ");
    throw new Error(`GraphQL 失敗(${detail})\n${head}`);
  }
  if (result.data === null) {
    throw new Error(`GraphQL 沒有回傳 data:${head}`);
  }
  return result.data;
}

/** 取第一個錯誤的 `extensions.code`(沒有錯誤時回 null)。 */
export function errorCodeOf<T>(result: GraphqlResponse<T>): string | null {
  return result.errors?.[0]?.extensions?.code ?? null;
}

/** 取第一個錯誤的 `extensions.reason`(欄位級權限回 `FIELD_FORBIDDEN`)。 */
export function errorReasonOf<T>(result: GraphqlResponse<T>): string | null {
  return result.errors?.[0]?.extensions?.reason ?? null;
}
