# GraphQL schema 設計(GQL)

schema 採 code-first:NestJS decorators 產出 `schema.gql`,產物不手改(GQL-05)。設計參考 Shopify GraphQL Design Tutorial。

## GQL-01 命名慣例

- type / input:PascalCase(`Recipe`、`CreateRecipeInput`)
- field / argument:camelCase(`cookMinutes`)
- enum 值:SCREAMING_SNAKE_CASE(`DRAFT`、`PUBLISHED`)

## GQL-02 mutation:動詞開頭、單一 input、回傳 payload type

```graphql
✅ createRecipe(input: CreateRecipeInput!): CreateRecipePayload!
❌ createRecipe(title: String!, description: String, servings: Int): Recipe
```

單一 input 物件讓欄位增減不破壞呼叫端;payload type 保留之後加欄位(如 userErrors)的空間。

## GQL-03 列表查詢統一分頁形狀

所有回傳列表的 query 用同一個形狀,一次定案全站一致:

```graphql
recipes(limit: Int! = 20, offset: Int! = 0): RecipeList!

type RecipeList {
  items: [Recipe!]!
  totalCount: Int!
}
```

(專案規模不需要 Relay cursor connection;若未來需要無限捲動再開討論、記 ADR。)

## GQL-04 錯誤:business error 用 `GraphQLError` + `extensions.code`

可預期的業務錯誤 throw `GraphQLError`,`extensions.code` 用列舉值;非預期錯誤讓框架轉 `INTERNAL_SERVER_ERROR`,不吞掉。初始 code 集(新增時回寫本條):

- `NOT_FOUND`、`VALIDATION_FAILED`、`UNAUTHENTICATED`、`FORBIDDEN`
- 登入線(#62,程式正本 `apps/api/src/auth/auth-error.ts`):`INVALID_CREDENTIALS`(帳號不存在與密碼錯誤同碼)、`ACCOUNT_DISABLED`、`TOO_MANY_ATTEMPTS`、`TOKEN_EXPIRED`(access token 或 refresh token 逾期)、`MUST_CHANGE_PASSWORD`;缺 token / 簽章不對 / `aud` 不符 / refresh 重放皆為 `UNAUTHENTICATED`,`switchOrg` 到所屬組織外為 `FORBIDDEN`

錯誤的 `message` 給開發者看(英文);給使用者的繁體中文文案由前端依 code 對應,不從 api 傳。

## GQL-05 `schema.gql` 是產物

由 api 啟動時自動生成,不手改;PR 內 schema 變更以 decorator 的 diff 為準。
