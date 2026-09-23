# 新增一個 CRUD 模組(scaffold 藍本)

給**沒有對話 session** 的 agent 或新成員:從零長出一個後台 CRUD 模組要動哪些檔、照什麼順序動、每一步的正本在哪裡。

藍本取自**示範家族**:[示範模組1](../modules/demo.sub.sample-one.md)(把所有選配都打開的完整示範)與 [示範模組2](../modules/demo.sample-two.md)(**對照組 —— 拿掉全部選配之後剩下的最小可行模組**)。要照抄就抄示範模組2,需要哪一項選配再回示範模組1 對照(選配清單見文末「示範模組 1 vs 2 差異對照表」)。

**這份文件不是規則的正本**,只是指路與順序:權限綁定看 ADR-0004、路由與判斷流程看 ADR-0011、資料範圍看 ADR-0008、基礎欄位看 ADR-0007、檔案儲存看 ADR-0010、前端分層看 ADR-0012、程式碼規範看 `docs/standards/README.md` 的索引。

## 檔案清單一覽

一個最小的 CRUD 模組(四頁、四筆權限、無選配)要新增或修改的檔案:

| 步驟        | 動的檔案                                                                                                                                                                                       | 正本 / 規則                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 0 規格      | `docs/modules/<模組key>.md`(新)                                                                                                                                                                | ADR-0004、本檔步驟 0                                         |
| 1 seed 宣告 | `apps/db-migrator/seeds/modules/<模組key>.ts`(新)、`seeds/modules.ts`(註冊)                                                                                                                    | `seeds/module-declaration.ts`、ADR-0002                      |
| 1b 示範資料 | `apps/db-migrator/seeds/<feature>.ts`(新)、`seeds/registry.ts`(註冊)                                                                                                                           | `seeds/demo-items.ts`、ADR-0002                              |
| 2 schema    | `apps/api/src/database/schemas/<entity>.schema.ts`(新)、`database/database.module.ts`(三處註冊)                                                                                                | ADR-0007、ADR-0005、`plugins/tenant-scope.plugin.ts`         |
| 3 api 模組  | `apps/api/src/<feature>/` 整包(新)、`app.module.ts`(掛載)                                                                                                                                      | `demo-items-two/`、STRUCT-01、GQL-02 / 03 / 04               |
| 4 documents | `packages/graphql/src/documents/<feature>.graphql`(新)+ 兩份產物                                                                                                                               | GQL-05                                                       |
| 5 admin     | `apps/admin/src/pages/<域>/<feature>-config.ts`、`<feature>-types.ts`、`<Xxx>Module.tsx`、三個頁面檔(新)、`app/module-pages.tsx`(登記四個 key)、`packages/i18n/messages/{zh-TW,en}/admin.json` | `pages/demo/shared/demo-module-config.ts`、ADR-0012、I18N-02 |
| 6 help      | `apps/admin/src/md/module-help/<模組key>.help.md`(新)                                                                                                                                          | FIGMA-04、CONTEXT.md 詞彙表                                  |
| 7 測試      | `apps/api/src/<feature>/*.test.ts`、`apps/admin/src/pages/<域>/**/*.test.tsx`、`apps/admin/src/test/msw/<feature>-handlers.ts`                                                                 | TEST-07、TEST-08                                             |
| 8 文件回寫  | `docs/modules/<模組key>.md` 補齊、`docs/data-model.md`、`CONTEXT.md`(有新詞才動)                                                                                                               | CLAUDE.md「Domain docs」                                     |

**新 worktree 開工先**:`pnpm install` → `pnpm exec turbo run build --filter=@repo/graphql --filter=@repo/ui --filter=@repo/domain`,否則 lint / typecheck 一開始就對 `@repo/*` 的型別報「cannot be resolved」。

## 步驟 0:先把規格寫進模組文件

`docs/modules/<模組key>.md` 是這個模組的**單一真相**,程式照它寫、劇本照它驗。動程式前先定下三件事:

1. **模組樹**:哪些節點、`sidebarType`(group / link / hidden)、掛在誰底下。慣例是**四個 key = 四頁**:列表(link)+ 詳情 / 新增 / 編輯(hidden,key 一律以 `-page` 結尾,見 CONTEXT.md「隱藏頁」)。無路由、只用來歸屬一組權限的節點是**權限容器**,key 不以 `-page` 結尾。
2. **權限表**:每一筆權限「是哪一頁的什麼」。綁定原則(ADR-0004)是**綁按鈕 / 欄位所在的那一頁** —— 跨頁共用的欄位綁父模組,某一頁自己的區塊綁那一頁。權限與端點、權限與頁面都**不必一一對應**(示範模組2 六個端點只用四個 key;示範模組1 的 `delete` 沒有自己的頁)。
3. **資料欄位**:哪些欄位、哪些要進資料範圍目錄。

CLAUDE.md 規定:動到環境變數同步 `docs/env-registry.md`、動到品牌元素同步 `docs/branding.md`。

## 步驟 1:seed 宣告(模組樹 / 權限 / dataScopeTarget)

正本型別:`apps/db-migrator/seeds/module-declaration.ts`(`ModuleSeedDeclaration`)。抄 `seeds/modules/demo.sample-two.ts`(最小)或 `demo.sub.sample-one.ts`(完整)。

新增 `apps/db-migrator/seeds/modules/<模組key>.ts`,匯出一份 `ModuleSeedDeclaration`,再到 `seeds/modules.ts` 的 `moduleDeclarations` 陣列註冊(**順序即宣告順序,父節點所在的檔案要排在前面**)。

- **`nodes`**:`key` 是**累加父 key**(`<父key>.<自己那段>`,靜態測試 `seed-key-convention.test.ts` 會擋);`route` **只寫自己那一段**(完整路徑由 api 累加,ADR-0011 步驟 7);`icon` 吃白名單型別 `@repo/domain/module-icon`(打錯字 `check-types` 就紅),不宣告即落庫 `null` = 側欄預設圖示;根組織專屬的節點標 `isRootOnly`(租戶管理員模板會扣除,ADR-0009)。
- **`permissions`**:只列**個別權限**。每個節點固定一筆的 wildcard `<key>.\*` 由 `seeds/modules.ts` 的 `wildcardPermission` 自動產生,**不要自己宣告**(宣告了就是重複一筆)。`moduleKey` 指向「這個按鈕 / 欄位所在的那一頁」。
- **`dataScopeTarget`**(選配,ADR-0008):要讓這張表能被資料範圍規則篩才宣告。`fields` **只放業務欄位**,基礎欄位(組織 / 建立者 / 日期)由程式自動附加;`enum` 型別要在這裡列出固定 `options`,`value` 必須與 schema 存的值一一對應。不宣告 = 查詢只受可見範圍保底(示範模組2 就是這個對照)。
- **`enabled` 與 `icon` 是「初始 seed 值的欄位」**(ADR-0002):建立後由人在「模組與權限」頁管理,重跑 seed 不會翻回宣告值。其餘欄位每次部署同步回宣告值。

**動到種子的數量或內容,連帶修 api 既有測試裡寫死的數字**(`apps/api/src/permission/permission.test.ts` 這類)—— 這屬於同一張票。

### 1b 示範 / 初始資料(選配)

抄 `apps/db-migrator/seeds/demo-items.ts`,在 `seeds/registry.ts` 註冊,**順序放在被引用者之後**(引用組織、欄位選項的資料放最後)。冪等以 `key` 識別(`key` 不是 schema 欄位,由 runner 寫在文件上);`seedRef` **只解析得到有 `key` 的種子文件**,所以引用不到 root 初始帳號這種沒有 `key` 的資料 —— 示範資料的建立者因此是固定的假 id。

## 步驟 2:schema(基礎欄位 plugin、租戶過濾)

新增 `apps/api/src/database/schemas/<entity>.schema.ts`,抄 `demo-item-two.schema.ts`:

- `@Schema({ collection: "<collection>", timestamps: true })`;`orgId` 必填(租戶資料的隔離邊界,ADR-0005);業務欄位逐欄寫 JSDoc(`docs/data-model.md` 指來這裡看細節);`enabled` 預設 `true`。
- 索引至少 `{ orgId: 1, createdAt: 1 }`。
- **兩個 plugin 一定要掛**:
  - `baseFieldsPlugin` —— 基礎欄位與軟刪除(ADR-0007)。
  - `tenantScopePlugin` —— 租戶過濾。**業務模組用預設的 `business`**(吃可見範圍),參數可省略;治理資料才傳 `{ kind: "governance" }`(吃管理範圍);以 `_id` 判可見的 `orgs` 另傳 `path`;全域種子資料用 `allowGlobal`。判準寫在 schema 上、不寫在呼叫端,同一張表在不同功能裡不換範圍。
- **`database.module.ts` 三處註冊**:`MongooseModule.forFeature` 的陣列、一個 `XxxRepository extends BaseRepository<Entity, EntityDocument>`、providers 與 exports;`HydratedDocument<Entity>` 的型別別名也在該檔。

沒有 `orgId`、歸屬走核心關聯的資料(users / roles 那種)**不掛** `tenantScopePlugin`,由模組先查關聯再查本表。

## 步驟 3:api 模組(resolver / service / error / audit / abilities)

新增 `apps/api/src/<feature>/`,抄 `demo-items-two/`(最小)或 `demo-items-one/`(完整),再掛進 `app.module.ts` 的 `imports`。

```
<feature>/
├── <feature>.module.ts          # imports: [DatabaseModule](AuditModule / PermissionModule 是 @Global,不必 import)
├── <feature>.resolver.ts        # 只做「守門 + 轉呼叫」(STRUCT-01)
├── <feature>.service.ts         # 規則全在這裡;查詢一律經 Repository,不自己寫範圍
├── <feature>-error.ts           # 錯誤的組裝;碼沿用 GQL-04 的通用碼
├── <entity>-mapper.ts           # document → model(有投影或衍生欄位才需要)
├── dto/                         # input(GQL-02:單一 input 物件)
├── models/                      # type 與 payload(GQL-02 / GQL-03)
└── test-support/fixtures.ts     # 測試夾具
```

- **守門**:resolver 每個端點一個 `@RequirePermission("<模組key>.<動作>")` + `@CurrentOperator()`;key 對應模組文件權限表的同一行。後端與前端吃的是同一個 `PermissionResolver`,兩邊永遠一致(ADR-0011)。
- **形狀**:mutation 一律回 payload(GQL-02);列表回 `{ items, totalCount }` 加全站現況的 `page` / `pageSize`(GQL-03)。型別名全 schema 唯一,撞名就加模組前綴(`DeleteDemoItemTwoPayload`)。
- **錯誤**:沿用 `FORBIDDEN` / `NOT_FOUND` / `VALIDATION_FAILED`(GQL-04),**不新增 code**;看不到的資料一律 `NOT_FOUND`,列表與單筆同一個答案(不透露存在與否)。可選輸入欄位的「缺席 vs `null`」語意逐欄寫進模組文件的「api 介面」節(GQL-06)。
- **`abilities`**:每筆資料回一組「這位操作者對這一筆能做什麼」,**由 api 依操作者的有效權限集算好、已含權限判斷**,前端只讀、不與 `usePermissions` 相乘(ADR-0011「abilities 的兩種語意」)。
- **稽核**:`AuditService.record`,動作 `<entity>.create` / `.edit` / `.delete` / `.toggle-enabled`,`targetType` 固定為該 collection 的單數名;`before` / `after` 只放有變的欄位。
- **自鎖**:`setXxxEnabled` 要不要套 `SELF_LOCK`,**拆票時就裁決並寫在票上**。判準:會讓操作者失去繼續操作能力(關掉就再也開不回來)的才套;業務資料的停用隨時開得回來,不套。

### 欄位級權限欄的四件事(選配,來源 #318)

某個欄位要另外一組權限才看得到 / 改得動時(示範模組1 的 `internalNote`),四件事缺一不可:

1. **投影**:沒有 `show-` 權限時,api **不把這個欄位放進回傳物件**(GraphQL 因此序列化成 `null`),列表與單筆一致。「沒權限」與「沒填」在值上長得一樣,所以前端**依自己的權限集**決定渲染與否,不拿值去猜。
2. **寫入守門**:欄位**一出現在 input 裡就要權限**(含送 `null` 清空),否則 `FORBIDDEN` + `extensions.reason = "FIELD_FORBIDDEN"`。
3. **稽核歷程一律 `[redacted]`**:`before` / `after` 只記「這個欄位變過」,不記內容 —— 否則沒有 `show-` 權限卻有「變更歷程」權限的人,可以從歷程把它讀出來,投影就白做了。
4. **keyword 不比對受權限欄**:清單搜尋只比對公開欄位(示範模組1 是 `name` / `note`)。比對了就等於提供一個「猜中即命中」的側信道,沒有權限的人照樣能問出內容。

歷程查詢(`xxxHistory(id)`)本身要**先驗這筆資料看不看得到**,否則歷程會變成繞過資料範圍規則的側門。

### 上傳(選配,ADR-0010)

`apps/api/src/storage/upload-rules.ts` 是正本:加一個 `UploadPurpose`,並在 `UPLOAD_VISIBILITIES`(公開 / 私有 bucket)、`UPLOAD_PATH_PREFIXES`、`UPLOAD_RULES`(允許的 content type → 副檔名、大小上限)各補一行。可見性是**用途的衍生屬性**,不另給參數。寫入「由前端回傳路徑」的欄位前一律先過 `isOwnedUploadPath`,不然呼叫端可以把任意 bucket 物件塞進 DB。公開 bucket 回**穩定 URL**(可直接放 `<img src>`),私有 bucket 只回路徑與檔名、下載時另外現簽(讀取網址的 query 名帶模組前綴,如 `demoItemOneAttachmentUrl`,GQL-02)。**要顯示原始檔名 / 大小就在寫入 input 一起收**(前端 `useDemoUpload` 已回 `{ path, name, size, contentType }`,即 `File.name` / `size` / `type`),存成與路徑同生同滅的平行欄位 —— 物件路徑是 `<uuid>.<副檔名>`,本身不帶原始檔名(先例示範模組1 的 `attachment`,#427)。

## 步驟 4:documents + codegen

新增 `packages/graphql/src/documents/<feature>.graphql`(query / mutation 文件),然後**依序**跑:

```
pnpm --filter @repo/api schema:generate
pnpm --filter @repo/graphql generate
```

`apps/api/schema.gql` 與 `packages/graphql/src/generated` 是同一條產線的前後兩段,**兩份產物要進同一個 commit**(GQL-05);CI 的「codegen 產物與 schema 一致」一步會擋。api-only 的票也一樣 —— 不補 document,下游的 admin 票撞不到 hook(GQL-07)。

**新環境第一次跑 `schema:generate` 前先 `pnpm exec turbo run build --filter=@repo/domain`**,否則 api 解不開 `@repo/domain` 的型別。

## 步驟 5:admin(一份設定物件 + 三個薄頁面檔)

前端藍本正本:`apps/admin/src/pages/demo/shared/demo-module-config.ts` 的 **`DemoModuleConfig`**(逐項 JSDoc 就是規格)。分工是:

- **共用元件**(`pages/demo/shared/` 的 `DemoListPage` / `DemoDetailPage` / `DemoFormPage`)負責版型、兩層權限判斷、分頁、未儲存離開確認、刪除確認、錯誤擺放位置 —— **一行都不用改**。
- **詳情頁要設 itemLabel**(#428,ADR-0011「頁籤兩種」):路由頁籤列把詳情 / 編輯頁顯示成「模組名 — 項目名」,項目名由頁面拿到資料後呼叫 `hooks/useRouteTabItemLabel(item.name)` 提供。共用的 `DemoDetailPage` / `DemoFormPage` 已接好;不用共用元件、自己寫詳情頁的模組要自己呼叫。
- **設定物件**負責「這個模組是什麼」:模組 key、權限 key、欄位定義、資料存取 hook、選配區塊。

共用元件**完全不認得任何模組的 GraphQL 型別**:資料存取一律由設定物件包成 `useRows` / `useItem` / `useSave` 三個 hook 交出來(只有刪除因為兩邊 input 同形 `{ id }` 才直接收 codegen 的 hook)。

要寫的檔案(對照示範模組2,四個檔加起來約 250 行,其中三個頁面檔各約 10 行):

| 檔案                                      | 內容                                                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `<feature>-config.ts`                     | 常數:`MODULE_KEY`、四個 `MODULE_KEYS`、整頁層級的 `PERMISSIONS`(view / create)、i18n namespace、`PAGE_SIZE`、`TABLE_MIN_WIDTH` |
| `<feature>-types.ts`                      | `Row` / `Detail` / `FormValues`(從 codegen 型別取,不手寫)                                                                      |
| `<Xxx>Module.tsx`                         | **一份 `DemoModuleConfig`** + 包好的 `useRows` / `useItem` / `useSave`                                                         |
| `<Xxx>Page.tsx` / `ViewPage` / `FormPage` | 各約 10 行:`<DemoListPage config={xxxModule} />` 之類                                                                          |

**`app/module-pages.tsx` 登記四個 key**(組裝層,STRUCT-03):列表 / 詳情 / 新增 / 編輯,其中**新增與編輯登記到同一個共版型元件**,情境由 `module.key` 判斷。沒登記的模組由殼顯示佔位頁(標題就是模組名)。路由本身仍由 `me.modules` 決定,這裡只決定「進去看到什麼」。

**兩層判斷分開問**(ADR-0011):

- **進得去哪一頁** = `me.modules` 有沒有那個模組。路由字串也從模組陣列取,**前端不寫死路徑**。沒綁詳情頁 → 列上沒有「檢視」;沒綁新增頁 → 即使有 `create` 權限也沒有新增鈕。
- **頁內能做什麼**:整頁層級的(新增鈕、頁內區塊)問權限集;**逐列 / 逐筆的編輯 / 刪除一律讀 api 給的 `item.abilities`**,不與 `usePermissions` 相乘。

**i18n**(I18N-02):`packages/i18n/messages/zh-TW/admin.json` 與 `en/admin.json` 各加一個 namespace,三頁共用;`columns.<key>` / `fields.<key>` / `form.<key>` 的 key 與設定物件的欄位 `key` 同名 —— 表單欄位的 `key` 同時是 `FormValues` 的鍵、i18n 的 key、**api 回報 `VALIDATION_FAILED` 時的欄位名**,三者同名,錯誤才標得回正確的欄位上。

**目前 `shared/` 那組共用元件掛在 `pages/demo/` 底下**(示範家族的共版型,#321)。正式業務模組要用時,把它搬到共用位置屬於另一張票 —— 搬之前先照抄一份也行,但兩份共用元件不要長期並存。

## 步驟 6:help.md(租戶使用者看的說明)

新增 `apps/admin/src/md/module-help/<模組key>.help.md`,**檔名必須等於模組 key**(`lib/module-help.ts` 以檔名對應;`lib/help-registry.ts` 的 `import.meta.glob` 在 build 時把內容內嵌進 bundle)。

- 結構沿用既有八份:`# <模組名>` → `## 這個模組做什麼` → `## 常用操作` → `## 重要規則`。
- **讀者是租戶使用者**:守 `CONTEXT.md` 詞彙表、**不得出現平台視角詞彙**(根組織 / 租戶 / 開通 / 跨租戶 / 平台);聯絡窗口一律寫「系統管理員」;「租戶管理員副本」在 UI 與 help 裡叫「預設角色」(FIGMA-04)。
- 對人的提示不用內部術語(「子樹」→「或其下層組織」)。
- 寫**使用者做得到的事與看得到的差異**,不寫實作(不出現 collection 名、權限 key、GraphQL 端點)。
- 交件前跑 `pnpm --filter @repo/admin check:help-bundle`(Dockerfile 也跑這一步):它驗每份 help.md 真的被打包進 `dist/assets`。`.dockerignore` 曾經把 `**/*.md` 擋在 build context 外,本機 build 正常但 image 裡三環境的說明全是空的(#259)。

## 步驟 7:測試

- **api(TEST-07)**:打真的 `/graphql`、對真 MongoDB。至少覆蓋:每個端點的權限守門(有 / 沒有該 key)、範圍(看不到的資料回 `NOT_FOUND`)、輸入驗證、稽核有沒有寫、`abilities` 的值。有欄位級權限的再加投影與寫入拒絕;有 `dataScopeTarget` 的加「規則命中 → 列表與單筆一致」;沒宣告的加「規則不介入」的對照。
- **admin(TEST-08)**:MSW 攔網路層 + RTL,`renderApp()` 渲染。至少覆蓋:權限驅動的渲染(按鈕出不出現、區塊顯不顯示)、路由防守(沒綁隱藏頁模組 → 無權限頁)、放棄變更、錯誤標回欄位。MSW handler **有連動 / 狀態語意就實作進 handler**,不要回固定資料。
- **不要把佔位夾具登記掉**:`apps/admin/src/test/msw/module-fixtures.ts` 的 **`placeholderModules`**(`demo.not-implemented`)是專門用來驗「殼對沒登記頁面的模組顯示佔位頁」的夾具模組,**永遠不會被實作**。新增真頁面時不要順手把它加進 `module-pages.tsx`。
- 跑法:`pnpm exec turbo run test --filter=@repo/api` / `--filter=@repo/admin`(turbo 會先 build 依賴)。只跑一個 admin 測試檔要**直接在 `apps/admin`** 跑 `node --experimental-vm-modules node_modules/jest/bin/jest.js --testPathPatterns=X`。

## 步驟 8:文件回寫

- `docs/modules/<模組key>.md` 補齊「api 介面」(GQL-06 / GQL-07 的正本寫在這裡)與「admin 頁面」兩節。
- `docs/data-model.md` 加該 collection 一列(欄位細節指向 schema 檔,不在地圖裡重抄)。
- `CONTEXT.md` 只在**真的長出新詞**時加;新詞要連 `_Avoid_` 一起寫。
- 模組文件與 help.md 是**實作票必然連動的兩處**;ADR、`docs/standards/`、CONTEXT 這類規則本文由文件票寫,實作發現寫錯**寫進 PR 的「規則回饋」**,不要就地改(`docs/agents/issue-tracker.md`)。

## 示範模組 1 vs 2 差異對照表(哪些是選配)

示範模組2 = 最小可行模組。下表每一列都是**可以不做**的東西;要做時照「示範模組1 怎麼做」那一欄找正本。

| 選配項目               | 示範模組1                                                | 示範模組2 | 不做的代價 / 怎麼做                                                                                                        |
| ---------------------- | -------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| **資料範圍目標**       | seed 宣告 `dataScopeTarget`(`demo_items_one`)            | 不宣告    | 不宣告 = 查詢只受**可見範圍**保底,「資料範圍」頁左側列不到它,規則機制不介入(ADR-0008)                                      |
| **enum 可篩欄位**      | `status`(草稿 / 已發布 / 已封存)                         | 無        | `dataScopeTarget.fields` 裡列 `type: "enum"` + 固定 `options`;value 與 schema 的欄位一一對應                               |
| **欄位級權限**         | `internalNote` + `show-` / `edit-internal-note` 兩筆權限 | 無        | 要做就是上面「欄位級權限欄的四件事」全做(投影 / 寫入守門 / 歷程 redact / keyword 不比對);前端以 `isVisible` 與 `mode` 表達 |
| **頁面自有權限(slot)** | 新增頁 `show-tips`、編輯頁 `show-history`                | 無        | 權限綁在那一頁的模組上;前端用設定物件的 `form.slots`(回 `null` 即不顯示)                                                   |
| **變更歷程**           | `demoItemOneHistory(id)` 讀 `audit_logs`                 | 無        | 歷程查詢要先驗這筆看不看得到;受權限欄在歷程裡一律 `[redacted]`                                                             |
| **雙路檔案儲存**       | 封面(公開 bucket)+ 附件(私有 bucket)                     | 無        | `upload-rules.ts` 加 purpose;前端用設定物件的 `form.uploads`(空陣列 = 沒有上傳欄)                                          |
| **模組自有篩選器**     | 分類 `Autocomplete`(選項來自欄位管理)                    | 無        | 設定物件的 `list.Filters`;不給就只有搜尋框                                                                                 |
| **外部選項來源**       | 分類選項來自欄位管理「示範分類」                         | 無        | 選項端點掛在**別的模組的權限**底下(`system.field-manager.view`)—— 沒有它的人:列表無該篩選、表單該欄唯讀並說明原因          |
| **模組專屬錯誤解讀**   | `demo-sample-one-error.ts`                               | 共用一份  | 錯誤碼一律沿用 GQL-04 通用碼,不新增 code                                                                                   |
| **三層模組樹**         | `demo > demo.sub > sample-one`                           | 兩層      | 純粹是樹的深度;`route` 各寫自己那一段,完整路徑由 api 累加                                                                  |
| **多筆個別權限**       | 8 筆(含欄位級與頁面自有)                                 | 4 筆      | 最小就是 view / create / edit / delete;wildcard 每個節點自動一筆                                                           |

**兩邊一樣、沒得選的**:四個模組 key = 四頁、共用的三個頁面元件、兩層判斷分開問、`abilities` 由 api 算好、`tenantScopePlugin` + `baseFieldsPlugin`、軟刪除、payload 形狀、審計四個動作、help.md、i18n 兩份字典。

### 選配、但兩支示範模組都做了的(2026-09-23 拆出,#359)

上表每一列都可以不做,而且**示範模組2 沒做**;下面這些**是選配、但兩支都示範了**,所以在上表裡會把「示範模組2 = 最小可行、每列都可不做」的語意撐開。要照抄最小模組時,這幾項也可以不做:

| 選配項目                                  | 兩支怎麼做                                                                    | 不做的代價 / 怎麼做                                                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **啟用 / 停用切換(選配:`useSetEnabled`)** | 各自有 `setDemoItemOneEnabled` / `setDemoItemTwoEnabled`,列表「啟用」欄是開關 | 設定物件不給 `useSetEnabled` = 這個模組沒有啟用 / 停用,列表維持唯讀 `Tag`;給了也只有 `abilities.canEdit` 為真的列才是開關 |

**選配的 hook 與 React 的 hook 規則相衝 —— 用「替身 hook」解,不要條件式呼叫**(#359):設定物件裡的 `useSetEnabled` 是選配,直覺寫法是 `config.useSetEnabled?.(…)`,但那是**條件式呼叫 hook**,`rules-of-hooks` 會擋(REACT-06),而且模組之間切換時 hook 數量會變。做法是在共用層準備一支**同簽章、什麼都不做**的替身(先例 `pages/demo/shared/useDemoQuery.ts` 的 `noDemoSetEnabled`,回一個恆 `undefined` / no-op 的結果),呼叫端一律 `(config.useSetEnabled ?? noDemoSetEnabled)(…)` —— hook 一定被呼叫、呼叫順序固定,「有沒有這個選配」變成資料而不是控制流。日後新增別的選配 hook 照同一個形狀做。

## 交件前檢查清單

- [ ] `pnpm exec turbo run check-types`、`lint`、`test` 全綠
- [ ] `pnpm format` 跑過(`format:check` 涵蓋 `.md` 與 `.ts` / `.tsx` / `.json` / `.yaml`)
- [ ] 動過 schema → `schema:generate` + `graphql generate` 兩份產物都在 commit 裡(GQL-05)
- [ ] `pnpm --filter @repo/admin check:help-bundle` 過
- [ ] `docs/modules/<模組key>.md` 與 help.md 同 PR 更新
- [ ] admin 票附 mock 模式截圖(`pnpm --filter @repo/admin dev:mock`,`http://localhost:3002`),逐張寫明哪一頁、什麼狀態
- [ ] 新增的環境變數 / 品牌元素同步 `docs/env-registry.md` / `docs/branding.md`
