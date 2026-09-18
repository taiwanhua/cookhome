# 前端資料存取(DATA)

## DATA-01 只用 `@repo/graphql` 的 codegen hooks

query / mutation 一律透過 codegen 產生的 `useXxxQuery` / `useXxxMutation`;禁止在 app 內手寫 gql 字串或自組 fetch。需要新查詢時:改 `packages/graphql` 的 `.graphql` 文件 → 跑 codegen → 用新 hook。

```ts
✅ const { data } = useRecipesQuery(client);
❌ const data = await client.request(`query { recipes { id } }`);
```

admin 傳給 hook 的 client 有兩個(`apps/admin/src/lib/auth/`):**`session.client`** 給登入後的查詢(自動帶 access token、`TOKEN_EXPIRED` 時靜默換票重送一次、`UNAUTHENTICATED` 清狀態導登入頁)、**`session.publicClient`** 只給 `login` / `refresh` / 密碼流程這幾個公開端點。拿錯 client 會在登入頁無限轉圈或已登入頁被當成沒登入。

登入者資料一律經 `hooks/useMe.ts` 的 `useMe()`(`me` query 的唯一包裝,`staleTime: Infinity`、**`retryOnMount: false`**)。`retryOnMount` 必須關:`me` 失敗(如 token 失效)後 `RequireAuth` 會導向登入頁並重新掛載,預設 `retryOnMount: true` 會在掛載時再打一次 → 再失敗 → 再導向,形成無限迴圈(#65 踩過)。其他「失敗就導向」的查詢比照。

## DATA-02 query key 交給 codegen,不自創字串

invalidate、prefetch 一律用 codegen 提供的 `useXxxQuery.getKey()`,保證與 hook 內部一致。

```ts
✅ queryClient.invalidateQueries({ queryKey: useRecipesQuery.getKey() });
❌ queryClient.invalidateQueries({ queryKey: ["recipes"] });
```

## DATA-03 Server Component 用 fetcher 模式

front 的 RSC 不能用 hooks,用 codegen 的 fetcher(現有範例:`apps/front/src/app/page.tsx`):

```ts
const { recipes } = await useRecipesQuery.fetcher(graphqlClient)();
```

## DATA-04 mutation 成功後精準 invalidate

用 DATA-02 的 getKey 逐一標明受影響的查詢;禁止整站 refetch 或重新整理頁面來「同步資料」。

## DATA-05 端點走環境變數

GraphQL endpoint 一律讀環境變數(front:`NEXT_PUBLIC_GRAPHQL_ENDPOINT`;admin:`VITE_GRAPHQL_ENDPOINT`),fallback 才是 localhost;禁止在元件或 lib 內硬編正式環境網址。
