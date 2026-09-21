# 示範模組1(技術)

**示範家族的目的**:①底座模板 — module-scaffold 產新模組的藍本 ②權限測試場(劇本見 [docs/testing/permission-scenarios.md](../testing/permission-scenarios.md))③新專案 bootstrap 後的活教材。家族含兩個模組:本篇(完整示範)與 [示範模組2](./demo.sample-two.md)(對照組)。

## 家族模組樹

可進入 = 角色綁了該模組(`role_module`,ADR-0011);矩陣 UI 保證勾下層必連動上層。

| key                               | 名稱                                 | sidebarType  | 自有權限            |
| --------------------------------- | ------------------------------------ | ------------ | ------------------- |
| `demo`                            | 示範群組                             | group        | 僅 `*`              |
| `demo.sub`                        | 示範次群組                           | group        | 僅 `*`              |
| `demo.sub.sample-one`             | 示範模組1                            | link(列表頁) | 見權限表            |
| `demo.sub.sample-one.view-page`   | 示範項目詳情                         | hidden       | 僅 `*`              |
| `demo.sub.sample-one.create-page` | 新增示範項目                         | hidden       | `*`、`show-tips`    |
| `demo.sub.sample-one.edit-page`   | 編輯示範項目                         | hidden       | `*`、`show-history` |
| `demo.sample-two` 一支            | 見 [示範模組2](./demo.sample-two.md) |              |                     |

`delete` 無對應頁(列表動作+確認彈窗)— 權限與頁面不必一一對應,本身即示範。

## 權限表(綁定原則:綁「按鈕/欄位所在的那一頁」,ADR-0004)

| 權限 key                                     | moduleId 指向        | 它是哪一頁的什麼                                                                                                                                                    |
| -------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `demo.sub.sample-one.*`                      | 示範模組1(列表頁)    | wildcard,代表本模組自己這層的全部權限(同層語意,ADR-0004;role_permission 只存這一筆)。每個模組(含群組與隱藏頁)都固定有一筆 `<key>.*`,由 seed 自動產生,本表不逐列重複 |
| `demo.sub.sample-one.view`                   | 示範模組1(列表頁)    | 看列表與單筆資料、進入檢視頁/打開檢視跳窗                                                                                                                           |
| `demo.sub.sample-one.create`                 | 示範模組1(列表頁)    | 進入新增頁的按鈕 + 新增 API                                                                                                                                         |
| `demo.sub.sample-one.edit`                   | 示範模組1(列表頁)    | 進入編輯頁的按鈕 + 編輯 API                                                                                                                                         |
| `demo.sub.sample-one.delete`                 | 示範模組1(列表頁)    | 列表的刪除按鈕 + 刪除 API                                                                                                                                           |
| `demo.sub.sample-one.show-internal-note`     | 示範模組1(列表頁=父) | 跨頁共用欄位:內部備註可見(詳情+編輯)                                                                                                                                |
| `demo.sub.sample-one.edit-internal-note`     | 示範模組1(列表頁=父) | 同上(可改;無此權限硬送寫入 → API 拒)                                                                                                                                |
| `demo.sub.sample-one.create-page.show-tips`  | 新增頁               | 頁面自有示範:填寫提示區塊                                                                                                                                           |
| `demo.sub.sample-one.edit-page.show-history` | 編輯頁               | 頁面自有示範:變更歷程區塊                                                                                                                                           |

## 資料

**demo_items_one**:name、category(欄位管理「示範分類」選項)、status(狀態:draft / published / archived,預設 draft)、note、internalNote(欄位級權限控)、coverPath(公開 bucket)、attachmentPath(私有 bucket)、enabled + 基礎欄位(ADR-0007)。

**資料範圍(ADR-0008)**:seed 宣告 `dataScopeTarget`(collection=demo_items_one),落庫至 `data_scope_targets`。可篩業務欄位只有 **`status`(enum,選項 草稿 / 已發布 / 已封存)**,基礎欄位由程式自動附加。它是全平台唯一的 enum 資料範圍欄位 —— 沒有它,「enum 固定選項」這條規則在任何環境都驗不到(#246);value 的正本是 seed 宣告,schema 的 `status` 一一對應。

連動 seed:欄位管理新增全域類別「示範分類」+ 數個選項。

## Seed 與環境

全環境灌同一份(seed 不分環境);`enabled` 初始 true,production 要關閉就在「模組與權限」頁手動停用(初始 seed 值欄位,不會被下次 seed 翻回,ADR-0002);納入租戶管理員模板。help:`apps/admin/src/md/module-help/demo.sub.sample-one.help.md`。畫面規劃見 dis.md #20。

## api 介面(#318;程式正本 `apps/api/src/demo-items-one/`)

```graphql
demoItemsOne(input: DemoItemsOneInput!): DemoItemsOnePayload!   # { items, totalCount, page, pageSize }
demoItemOne(id: ID!): DemoItemOnePayload!                        # { item }
demoItemOneHistory(id: ID!): DemoItemOneHistoryPayload!          # 需 edit-page.show-history
attachmentDownloadUrl(id: ID!): SignedUrlPayload!                # { url };私有附件現簽,需 view

createDemoItemOne(input: CreateDemoItemOneInput!): DemoItemOnePayload!
updateDemoItemOne(input: UpdateDemoItemOneInput!): DemoItemOnePayload!
deleteDemoItemOne(input: DeleteDemoItemOneInput!): DeleteDemoItemOnePayload!  # { success, deletedId }
setDemoItemOneEnabled(input: SetDemoItemOneEnabledInput!): DemoItemOnePayload!

type DemoItemOne {
  id: ID!
  name: String!
  category: String # 欄位管理「示範分類」的選項 value
  categoryLabel: String # 該 value 在操作者合併範圍內的顯示名稱
  note: String
  internalNote: String # 欄位級權限(見下)
  coverPath: ID # 公開 bucket 的物件路徑
  coverUrl: String # 公開**穩定** URL(不過期)
  attachment: DemoItemOneAttachment # { path, name };下載網址另簽
  status: DemoItemOneStatus! # DRAFT / PUBLISHED / ARCHIVED
  enabled: Boolean!
  createdBy: DemoItemOneUserRef # { id, name }
  createdAt: DateTime!
  updatedAt: DateTime!
  abilities: DemoItemOneAbilities! # { canEdit, canDelete, canEditInternalNote }
}

input DemoItemsOneInput {
  page: Int = 1
  pageSize: Int = 20 # 上限 100
  keyword: String # 比對 name / note
  category: String
  enabled: Boolean
}
```

分頁形狀依 GQL-03(`items` + `totalCount`)加上全站現況的 `page` / `pageSize`;mutation 一律回 payload(GQL-02)。

**回傳欄位的語意**(GQL-07:正本在此,前端段只引用):

- **`internalNote` 是欄位級權限欄(綁父模組,ADR-0004)**:沒有 `demo.sub.sample-one.show-internal-note` 時,api **不把這個欄位放進回傳物件**(GraphQL 因此序列化成 `null`),列表與單筆一致。「沒權限」與「沒填」在值上長得一樣,所以**前端依自己的權限集決定要不要渲染這個欄位**,不要拿值去猜。
- **`abilities` 由 api 依操作者的有效權限集算好,每個旗標都已含權限判斷**:前端**直接用**,不要再與 `usePermissions` 相乘(同一條規則兩邊各算一次,對不起來就是畫面與 API 不一致)。與角色頁的 `RoleAbilities` 不同 —— 那組刻意不含權限 key,因為它表達的是「角色種類規則」。`canEditInternalNote` 為 false 但 `internalNote` 有值 = 看得到、改不動(唯讀)。
- **`coverUrl` 是公開 bucket 的穩定 URL**(不簽名、不過期,可直接放 `<img src>`、可快取);**附件只給 `attachment { path, name }`**,下載要另外呼叫 `attachmentDownloadUrl(id)` 現簽短效網址(ADR-0010 的雙路)。`attachment.name` 是物件路徑的最後一段(`<uuid>.<副檔名>`)—— 上傳票不保留使用者當初選的檔名。
- **`categoryLabel`**:分類已被停用、或屬於操作者看不到的組織時為 `null`(`category` 仍原樣回)。
- **`createdBy` 查不到那位使用者時一律回 `null`,不拋錯**:seed 的示範資料用假的 ObjectId 當建立者(#319),真實環境也會有使用者被刪掉的情形;前端顯示「—」即可。

**可選輸入欄位的缺席 / `null` 語意**(GQL-06):

| 欄位                                              | `createDemoItemOne`                 | `updateDemoItemOne`                      |
| ------------------------------------------------- | ----------------------------------- | ---------------------------------------- |
| `name`                                            | 必填(空白 → 拒)                     | 缺席 / `null` = 不動                     |
| `status`                                          | 缺席 / `null` = 草稿                | 缺席 / `null` = 不動                     |
| `category`、`note`、`coverPath`、`attachmentPath` | 缺席 / `null` = 不設                | **缺席 = 不動、`null` = 清空**(`$unset`) |
| `internalNote`                                    | 同上,但**欄位一出現就要權限**(見下) | 同上                                     |

**上傳**(ADR-0010):`createUploadUrl` 的 purpose 新增 `DEMO_COVER`(公開 bucket)與 `DEMO_ATTACHMENT`(私有 bucket),路徑一律 `demo/<uuid>.<副檔名>`;兩者都要 `demo.sub.sample-one.create` 或 `.edit`。寫入 `coverPath` / `attachmentPath` 時 api 會驗「是不是本 API 簽出來的路徑」(`isOwnedUploadPath`),不是就 `VALIDATION_FAILED`。

**範圍**:`demo_items_one` 掛 `tenantScopePlugin`(業務類),所以每一條查詢(含寫入與刪除)都先吃**可見範圍**(ADR-0005)再套**資料範圍規則**(ADR-0008);service 不自己寫範圍。看不到的資料一律 `NOT_FOUND`,列表與單筆同一個答案。

### 錯誤(沿用 GQL-04 的通用碼,不新增 code)

| 情況                                                                     | 回什麼                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 端點所需權限不足(`view` / `create` / `edit` / `delete` / `show-history`) | `FORBIDDEN`(由 `@RequirePermission` 擋,無 `reason`)                |
| input 裡出現 `internalNote`(含送 `null` 清空)但沒有 `edit-internal-note` | `FORBIDDEN` + `extensions.reason = "FIELD_FORBIDDEN"`              |
| 名稱空白                                                                 | `VALIDATION_FAILED`,`fields: ["name"]`                             |
| 分類不在操作者的**合併範圍**內、或該選項已停用                           | `VALIDATION_FAILED`,`fields: ["category"]`                         |
| `coverPath` / `attachmentPath` 不是本 API 簽出來的路徑                   | `VALIDATION_FAILED`,`fields: ["coverPath"]` / `["attachmentPath"]` |
| 資料不在可見範圍 / 資料範圍內、id 不存在、這筆沒有附件                   | `NOT_FOUND`                                                        |

### 審計

`targetType` 一律 `demo_item_one`;動作 `demo-item-one.create` / `.edit` / `.delete` / `.toggle-enabled`。
`before` / `after` 只放**有變的欄位**;**`internalNote` 只記 `"[redacted]"`,不記內容** —— 否則沒有 `show-internal-note` 卻有 `edit-page.show-history` 的人可以從變更歷程把它讀出來,投影就白做了。

`demoItemOneHistory(id)` 就是讀這批紀錄(target = 該筆,新到舊,不分頁);它**先驗這筆資料看不看得到**,不然歷程會變成繞過資料範圍規則的側門。

### 停用不套自鎖

`setDemoItemOneEnabled` 不套 `SELF_LOCK`:停用一筆業務資料隨時可以再啟用回來,不會讓操作者失去繼續操作的能力(自鎖只守「關掉就再也開不回來」的寫入)。

## admin 頁面(#320;程式正本 `apps/admin/src/pages/demo/`)

四個模組 key = 四頁,`app/module-pages.tsx` 各登記一個元件;**新增與編輯是同一個共版型元件**,情境由 `module.key` 判斷。

| 模組 key                          | 網址                                  | 元件                                      |
| --------------------------------- | ------------------------------------- | ----------------------------------------- |
| `demo.sub.sample-one`             | `/demo/sub/sample-one`                | `SampleOnePage/SampleOnePage.tsx`         |
| `demo.sub.sample-one.view-page`   | `/demo/sub/sample-one/view-page/<id>` | `SampleOneViewPage/SampleOneViewPage.tsx` |
| `demo.sub.sample-one.create-page` | `/demo/sub/sample-one/create-page`    | `SampleOneFormPage/SampleOneFormPage.tsx` |
| `demo.sub.sample-one.edit-page`   | `/demo/sub/sample-one/edit-page/<id>` | 同上(共版型)                              |

**設定集中在一份物件**:`pages/demo/demo-sample-one-config.ts` 放模組 key、權限 key、欄位定義、查詢 hooks、上傳規則與 i18n namespace;三頁只描述「怎麼畫」。換一個模組要動的就是這一份 —— 示範模組2(#321)與 module-scaffold 據此抽共版型。

**路由尾端的識別碼**:詳情與編輯頁的模組路由本身不含 `<id>`(seed 的 route 是 `view-page` / `edit-page`),所以殼的路由防守多一條退路 —— 精準比對落空時,**只對 hidden 模組**再試一次「去掉最後一段」(`lib/module-tree.ts` 的 `matchModuleRoute`),解出來的那一段以 `routeParam` 傳給頁面。link 頁(列表)後面多接一段仍然是無權限頁;「可進 = 有那個模組路由」這條規則沒有放寬。

**兩層判斷分開問**(ADR-0011):

- **進得去哪一頁**看 `me.modules` 有沒有那個模組(`useSampleOneAccess`,路由字串也從模組陣列取,前端不寫死路徑)。沒綁詳情頁 → 列上沒有「檢視」;沒綁新增頁 → 即使有 `create` 權限也沒有新增鈕。
- **頁內能做什麼**:整頁層級的問權限集(內部備註可見 / 可改、填寫提示、變更歷程);**逐列的編輯 / 刪除 / 內部備註可改一律讀 api 給的 `item.abilities`**,不與 `usePermissions` 相乘。

**內部備註的三態**在表單上是 `hidden` / `readonly` / `editable`:沒有 `show-internal-note` 時**整欄不渲染**,而且 input 裡連這個鍵都不會出現(欄位一出現就要權限,送 `null` 也會被 `FIELD_FORBIDDEN` 擋)。

**分類下拉的選項**來自 `fieldCategories` → `fields(categoryId)`,兩個端點都掛在 `system.field-manager.view` 底下。沒有那個權限時:列表不顯示分類篩選、表單的分類欄退成唯讀(保留原值並說明原因)。停用的選項不列入可選清單。

**錯誤對應**:`VALIDATION_FAILED` 依 `extensions.fields` 標在對應欄位上(`name` / `category` / `coverPath` / `attachmentPath`),其餘(`FORBIDDEN` 含 `FIELD_FORBIDDEN`、`NOT_FOUND`)用一條 Alert 說明;解讀集中在 `pages/demo/demo-sample-one-error.ts`。

**與設計稿的差異**(Figma 175:3 / 175:318 / 175:558 / 177:2314)見 PR #320 的差異表。
