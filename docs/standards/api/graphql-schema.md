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

**例外:沒有任何輸入的 mutation 不做空的 input**(如 `refresh`、`logout`、`logoutAllDevices` — 身分來自 token 與 cookie)。硬給一個 `input: {}` 只是為了形式一致,對呼叫端沒有價值。

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

可預期的業務錯誤 throw `GraphQLError`,`extensions.code` 用列舉值;非預期錯誤讓框架轉 `INTERNAL_SERVER_ERROR`,不吞掉。GraphQL 永遠回 HTTP 200,**前端只能靠 code 分流**,所以每個 code 都要說清楚「什麼情況回它、前端該做什麼」。code 清單(新增時回寫本條;登入線的程式正本 `apps/api/src/auth/auth-error.ts`):

| code                       | 什麼情況回它                                                                                                   | 前端該做什麼                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `NOT_FOUND`                | 查的資料不存在                                                                                                 | 顯示找不到                                                                       |
| `VALIDATION_FAILED`        | 輸入不合法                                                                                                     | 表單顯示錯誤                                                                     |
| `UNAUTHENTICATED`          | **等於沒登入**:沒帶 token、token 偽造或簽章不對、會員的 token(`aud=front`)打後台、refresh token 被重放或已登出 | 清掉登入狀態,導向登入頁                                                          |
| `TOKEN_EXPIRED`            | access token 或 refresh token **逾期**(正常現象,access 每 15 分鐘一次)                                         | access 逾期:靜默用 cookie 換一張後重送原請求;refresh 也逾期:同 `UNAUTHENTICATED` |
| `FORBIDDEN`                | **有登入,但做了不被允許的事**:沒有該權限、切到不屬於自己的組織                                                 | 顯示無權限提示,**不**登出                                                        |
| `INVALID_CREDENTIALS`      | 登入時帳號不存在**或**密碼錯(同一碼,且回應耗時相同,不可枚舉帳號)                                               | 顯示「帳號或密碼錯誤」                                                           |
| `ACCOUNT_DISABLED`         | 帳號已停用(登入時,或已登入者的下一次請求)                                                                      | 顯示帳號已停用,清登入狀態                                                        |
| `TOO_MANY_ATTEMPTS`        | 同帳號連續 5 次登入失敗,鎖 1 分鐘                                                                              | 顯示稍後再試                                                                     |
| `MUST_CHANGE_PASSWORD`     | 首登須改密碼者做了「看自己 / 改密碼 / 登出」以外的操作                                                         | 導向改密碼頁                                                                     |
| `ACTION_TOKEN_INVALID`     | 信件連結的 token(啟用 / 重設密碼)不存在、已用過或逾期 — 三者同碼,不透露差別                                    | 顯示「連結已失效」+ 一鍵重新申請;**不是** `TOKEN_EXPIRED`,不要換票重送           |
| `CURRENT_PASSWORD_INVALID` | 已登入者改密碼時「目前密碼」打錯(本人操作,無枚舉風險,所以可以明講)                                             | 顯示「目前密碼錯誤」                                                             |

錯誤的 `message` 給開發者看(英文);給使用者的繁體中文文案由前端依 code 對應,不從 api 傳。

## GQL-05 `schema.gql` 是產物

由 api 啟動時自動生成,不手改;PR 內 schema 變更以 decorator 的 diff 為準。
