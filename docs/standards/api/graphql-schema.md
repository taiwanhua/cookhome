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

**Spec 的 Interface design 也一律照本條寫 payload type**(2026-09-20 裁決,#204 / #206 / #205 / #203 各撞一次):spec 裡寫 `createField(input: …): Field!`、`role(id): Role!` 這種裸型別是簡寫,實作時**照 GQL-02 補 payload**,不必回頭改 spec;query 回清單照 GQL-03 的 `{ items, totalCount }`。**例外:樹狀回傳可以裸回陣列**(`moduleTree: [ModuleAdminNode!]!` 是先例 — 它不是清單、沒有 `totalCount` 可言,包一層只是多一層)。同一份 spec 的多張票並行時,這條決定哪一邊都行**但要先定案**,否則四票四種形狀。

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

| code                       | 什麼情況回它                                                                                                                                                                                                          | 前端該做什麼                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `NOT_FOUND`                | 查的資料不存在                                                                                                                                                                                                        | 顯示找不到                                                                       |
| `VALIDATION_FAILED`        | 輸入不合法                                                                                                                                                                                                            | 表單顯示錯誤                                                                     |
| `UNAUTHENTICATED`          | **等於沒登入**:沒帶 token、token 偽造或簽章不對、會員的 token(`aud=front`)打後台、refresh token 被重放或已登出                                                                                                        | 清掉登入狀態,導向登入頁                                                          |
| `TOKEN_EXPIRED`            | access token 或 refresh token **逾期**(正常現象,access 每 15 分鐘一次)                                                                                                                                                | access 逾期:靜默用 cookie 換一張後重送原請求;refresh 也逾期:同 `UNAUTHENTICATED` |
| `FORBIDDEN`                | **有登入,但做了不被允許的事**:沒有該權限、切到不屬於自己的組織                                                                                                                                                        | 顯示無權限提示,**不**登出                                                        |
| `INVALID_CREDENTIALS`      | 登入時帳號不存在**或**密碼錯(同一碼,且回應耗時相同,不可枚舉帳號)                                                                                                                                                      | 顯示「帳號或密碼錯誤」                                                           |
| `ACCOUNT_DISABLED`         | 帳號已停用(登入時,或已登入者的下一次請求)                                                                                                                                                                             | 顯示帳號已停用,清登入狀態                                                        |
| `TOO_MANY_ATTEMPTS`        | 同帳號連續 5 次登入失敗,鎖 1 分鐘                                                                                                                                                                                     | 顯示稍後再試                                                                     |
| `MUST_CHANGE_PASSWORD`     | 首登須改密碼者做了「看自己 / 改密碼 / 登出」以外的操作                                                                                                                                                                | 導向改密碼頁                                                                     |
| `ACTION_TOKEN_INVALID`     | 信件連結的 token(啟用 / 重設密碼)不存在、已用過或逾期 — 三者同碼,不透露差別                                                                                                                                           | 顯示「連結已失效」+ 一鍵重新申請;**不是** `TOKEN_EXPIRED`,不要換票重送           |
| `CURRENT_PASSWORD_INVALID` | 已登入者改密碼時「目前密碼」打錯(本人操作,無枚舉風險,所以可以明講)                                                                                                                                                    | 顯示「目前密碼錯誤」                                                             |
| `UPLOAD_REJECTED`          | 要上傳票時檔型不在白名單(png / jpg / webp)或大小超過 2MB(ADR-0010;程式正本 `apps/api/src/storage/storage-error.ts`)                                                                                                   | 顯示「只能上傳 PNG / JPG / WebP,且不超過 2MB」,讓使用者重選檔案                  |
| `LAST_ORG`                 | 移除所屬組織後使用者會一個組織都不剩(至少要有一個,ADR-0003;程式正本 `apps/api/src/users/users-error.ts`)                                                                                                              | 提示「至少要保留一個所屬組織」,把該筆勾選還原                                    |
| `ROLE_OUT_OF_REACH`        | 防越權:要授予 / 儲存的角色,其擁有組織不在操作者的管理範圍內(ADR-0003;2026-09-20 / #211 統一判準,原為「不是操作者自己持有的」)                                                                                         | 提示無法授予該角色並重新載入可選清單(清單本來就只列可觸及的角色)                 |
| `OWNER_PROTECTED`          | 擁有者保護:租戶擁有者被停用 / 被移出租戶 / 其「租戶管理員」授予被解除(ADR-0009;根組織操作者不受限)                                                                                                                    | 提示「租戶擁有者受保護,請聯絡平台管理者」,不要重試                               |
| `CROSS_TENANT`             | 搬移組織時新上層不在同一個租戶(程式正本 `apps/api/src/orgs/org-error.ts`)                                                                                                                                             | 顯示「只能搬到同一個頂層組織之下」,樹上不讓放                                    |
| `CYCLIC_MOVE`              | 搬移組織時新上層是自己或自己的子孫(會造出環)                                                                                                                                                                          | 顯示「不能搬到自己的下層」,樹上不讓放                                            |
| `ORG_NOT_DELETABLE`        | 刪除組織的前置檢查未過;`extensions.reasons` 逐項列出(`HAS_CHILDREN` / `HAS_MEMBERS` / `OWNS_ROLES` / `HAS_BUSINESS_DATA` / `SYSTEM_ORG`)                                                                              | 依 reasons 逐項顯示中文原因,並引導改用停用                                       |
| `RULE_INVALID`             | 資料範圍規則不合法:欄位不在目錄、運算子不符型別、值來源不符型別…;`extensions.path` 指到條件樹裡的位置、`extensions.reason` 是原因列舉(程式正本 `apps/api/src/data-scope/data-scope-error.ts` 與 `data-scope-rule.ts`) | 依 reason 顯示中文原因,並把錯誤標在 `path` 指到的那一列條件上                    |
| `FIELD_VALUE_DUPLICATE`    | 欄位選項的 `value` 在同一類別下重複:本組織已有同 value 的自訂選項,或與該類別的全域種子選項同 value(程式正本 `apps/api/src/fields/fields-error.ts`)                                                                    | 把錯誤標在「值」欄位(`extensions.fields` 為 `["value"]`),要求改一個值            |
| `ROLE_NOT_DELETABLE`       | 刪除角色的前置檢查未過;`extensions.reasons` 逐項列出(`HAS_GRANTS` / `SYSTEM_ROLE` / `TEMPLATE_COPY`;程式正本 `apps/api/src/roles/roles-error.ts`)                                                                     | 依 reasons 逐項顯示中文原因,並引導改用停用                                       |
| `USER_NOT_ELIGIBLE`        | 角色的「加入使用者」候選規則未過:該使用者的所屬組織皆不在角色擁有組織的子樹內(ADR-0003)                                                                                                                               | 提示該使用者不在此角色的管轄範圍內,並重新載入候選清單(清單本來就只列有資格的人)  |

錯誤的 `message` 給開發者看(英文);給使用者的繁體中文文案由前端依 code 對應,不從 api 傳。

**同一個 code 有多種說法時加 `extensions.reason`,不要新增 code**(2026-09-21 / #264 追加;先例 `RULE_INVALID` 的 `reason`、`ORG_NOT_DELETABLE` 的 `reasons`):通用碼(`FORBIDDEN` / `NOT_FOUND`)的語意全站一致,分歧的是「為什麼」。`reason` 的列舉值屬該模組,正本放模組自己的 error 檔(如 `apps/api/src/fields/fields-error.ts` 的 `FIELD_FORBIDDEN_REASONS`:`SEED_READ_ONLY` / `SEED_GLOBAL_SWITCH` / `NOT_OWNER`)並在模組文件的「錯誤」節逐項寫明,不進本表 — 本表只列 code。前端認不得的 `reason` 要能退回該 code 的通用文案。

**多票並行時這張表的衝突解法**(2026-09-20 / 第 4 段四票各追加一列):每張票**只追加自己的列**,但
追加一列會讓 prettier 重排整張表的欄寬(STRUCT-09),所以 diff 看起來整張表都動了。合併衝突時
**保留兩邊的新列後重跑 `pnpm format`,不要照行比對**(照行比對必定弄丟其中一邊的欄寬或列)。

**推論**(2026-09-21 / #261):**能不動上面那張表就不動**。改一列的內容一樣會重排整張表,
對 `dev` 必衝突 —— 要補充既有 code 的語意,寫在本節下方的段落裡,表只留給「真的新增一個 code」。

### `FORBIDDEN` 的 `extensions.reason`(2026-09-21 / #261)

`FORBIDDEN` 是通用碼,光看碼分不出「為什麼不行」,所以**受規則保護**的那幾種情形另附 `reason`,
前端據此顯示不同的一句話。這是 `reason` 不是新的 `code`,所以上表不增列:

| `reason`                  | 什麼情況回它                                                                                               | 程式正本                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `SYSTEM_ROLE`             | 動到種子角色(改名、編權限矩陣、停用 / 啟用);它隨底座出貨,內容隨版本更新                                    | `apps/api/src/roles/roles-error.ts`                   |
| `TEMPLATE_COPY_ROOT_ONLY` | 非根組織的操作者要停用**預設角色**(租戶副本)                                                               | 同上                                                  |
| `SELF_LOCK`               | 自鎖保護:停用操作者**自己正持有的角色**,或停用 `system.module-manager` 子樹與其權限                        | 同上 / `modules/module-manager-error.ts`              |
| `FIELD_FORBIDDEN`         | **欄位級權限**(ADR-0004):input 裡出現一個操作者不能寫的欄位(含送 `null` 清空)。端點本身可以用,擋的是那一欄 | `apps/api/src/demo-items-one/demo-items-one-error.ts` |

規則表正本見 ADR-0004「角色種類與可改動範圍」與 `docs/modules/role-manager.md`。

### `USER_NOT_ELIGIBLE` 的兩個入口(2026-09-21 / #261)

上表的 `USER_NOT_ELIGIBLE` 原本只寫角色頁的「加入使用者」。它現在是**授予資格的唯一錯誤碼**,
兩個入口同碼:角色頁的 `grantRoleUsers` 與使用者頁的 `assignUserRoles`(後者原為
`VALIDATION_FAILED`,前端只講得出「資料未通過驗證」)。判斷本身也只有一份
(`apps/api/src/users/org-qualification.service.ts` 的 `assertEligible`)。

`extensions` 附 `roleId` 與 `ownerOrgName`,前端據此顯示
「此角色只能授予 <ownerOrgName> 及其下層的使用者」,並把該列設為 disabled。

## GQL-05 `schema.gql` 是產物

由 api 啟動時自動生成,不手改;PR 內 schema 變更以 decorator 的 diff 為準。

**重生指令**:`pnpm --filter @repo/api schema:generate`(`apps/api/scripts/generate-schema.ts`:起一次完整 AppModule 讓 GraphQLModule 寫檔,跑完自動退出;不必先啟 api、也不碰真資料庫)。改過 resolver / model / input 後跑一次,把產物一起進 commit。

## GQL-06 可選輸入欄位的「缺席」與 `null` 若語意不同,必須寫在模組文件的 api 介面段

`updateOrg` 的 `logoPath`:缺席 = 不動、`null` = 清空。這個差異沒寫在任何地方,前端就一律送欄位,結果只改名稱會把商標清掉(#186)。規則:凡可選輸入欄位有「缺席 / null」語意差異,在 `docs/modules/<key>.md` 的「api 介面」節逐欄寫明;前端 mutation 的 input 只放使用者碰過的欄位。

## GQL-07 跨 api / 前端的欄位語意,正本寫在模組文件的「api 介面」節,前端段只引用

`OrgNode.parentId` 對每棵樹的根一律回 `null`(不是真的上層),api 測試有斷言,但模組文件的前端段寫成「`parentId` 為 null = 站在根組織」,兩位實作者各照自己那半邊寫,前端拿它判視角就錯了(#186)。回傳欄位的語意只在 api 介面段定義一次;前端段需要時引用該段,不另寫解釋。api-only 的票也要**同 PR 補前端要用的 operation 文件**(`packages/graphql/src/documents/*.graphql` + generate),否則下游票撞不到 hook(#137 → #138)。
