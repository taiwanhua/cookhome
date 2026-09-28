# 示範表單(技術)

> **表單模組的範例**:新開一個「欄位由使用者在後台設計」的模組,照這份與 [module-scaffold 的「表單模組路線」](../agents/module-scaffold.md#表單模組路線)。表單引擎本身的規則在 [forms](./forms.md),審核流程在 [workflows](./workflows.md),概念見 `docs/concepts/form-engine.md`。

## 用途

三個表單模組(`engine: "form"`)的示範,把表單模組在側欄的三種位置都示範到:頂層、群組內、次群組內。三個的骨架完全相同(路由、三個隱藏頁、四筆權限、資料範圍目標)由 seed 宣告;**表單**(欄位、版面、版本、分派、啟用)與**審核流程**(設計、發布、綁定)都由平台與租戶在畫面上建,seed 不建表單、不建流程、不綁定。頁面四個 key 全用表單引擎的預設組裝;表單綁了流程時,詳情頁下方自動掛審核區塊。

名字與路由刻意看得出是示範:production 不要的話,在「模組與權限」頁停用即可(`enabled` 是初始 seed 值欄位,重跑 seed 不會翻回來)。

正本:`apps/db-migrator/seeds/form-module-declaration.ts`(共用的骨架產生函式)、`apps/db-migrator/seeds/modules/demo-form.ts`、`demo.form.ts`、`demo.sub.form.ts`

## 模組 key 與畫面

| key             | 名稱               | 位置                    | 路由             |
| --------------- | ------------------ | ----------------------- | ---------------- |
| `demo-form`     | 示範表單(頂層)     | 頂層(`parentKey: null`) | `/demo-form`     |
| `demo.form`     | 示範表單(群組內)   | `demo` 群組底下         | `/demo/form`     |
| `demo.sub.form` | 示範表單(次群組內) | `demo.sub` 次群組底下   | `/demo/sub/form` |

每個模組底下三個隱藏頁(以 `<key>` 代表上表任一個,`<路由>` 是它的路由):

| key                 | 名稱 | sidebarType | 路由                           | 自有權限 |
| ------------------- | ---- | ----------- | ------------------------------ | -------- |
| `<key>.view-page`   | 詳情 | hidden      | `<路由>/view-page/<id>`        | 僅 `*`   |
| `<key>.create-page` | 新增 | hidden      | `<路由>/create-page/<formKey>` | 僅 `*`   |
| `<key>.edit-page`   | 編輯 | hidden      | `<路由>/edit-page/<id>`        | 僅 `*`   |

- 新增頁網址最後一段是**表單 key**:此刻可新增的表單只有一張時列表的新增鈕直接進,多張時先跳選單;網址沒帶表單 key 時同樣處理。
- 四頁在 `apps/admin/src/app/module-pages.tsx` 以 `...formModulePages(<模組 key 常數>)` 登記,元件在 `apps/admin/src/components/form-engine/FormModulePages/`。
- 頁籤 / 標題 = 模組層模板(預設 `{{title}}`)套摘要槽,表單的 `tabLabelTemplate` 可覆寫。

正本:上列 seed 檔、`apps/admin/src/app/module-pages.tsx`

## 權限表

三個模組各一份,形狀相同(`<key>` 同上):

| 權限 key                             | moduleId 指向 | 它是哪一頁的什麼                                                  |
| ------------------------------------ | ------------- | ----------------------------------------------------------------- |
| `<key>.*`                            | 列表頁        | wildcard(同層語意);seed 自動產生;也涵蓋發布時建的欄位級權限       |
| `<key>.view`                         | 列表頁        | 列表與單筆                                                        |
| `<key>.create`                       | 列表頁        | 新增鈕、建 / 存 / 送 / 刪自己的草稿                               |
| `<key>.edit`                         | 列表頁        | 修改已完成的提交(每改一次修訂號 +1);綁流程的單核准後只能作廢      |
| `<key>.delete`                       | 列表頁        | 刪除已完成的提交                                                  |
| `<key>.show-<formKey>-<fieldKey>` 等 | 列表頁        | 欄位級(`source: dynamic`,表單發布時建;規則見 [forms](./forms.md)) |

端點在執行期依這四筆判(`moduleKey` 在 input 或提交上),不是 `@RequirePermission`。逐列的編輯 / 刪除一律看 api 給的 `abilities`。租戶管理員範本由模組宣告推導,三個模組都自動納入。

## 資料

- **提交**存所有表單模組共用的 `form_submissions`(模組資料表),`moduleKey` = 所屬模組 key。欄位與索引見 `docs/data-model.md`。
- **資料範圍目標**:每個模組一列(`form_submissions` + 模組 key;「資料範圍」頁左清單顯示模組名,副文字 `form_submissions`);欄位目錄 = 基礎欄位 + 提交狀態。狀態選項給**完整七種**(草稿 / 審核中 / 已退回 / 已撤回 / 已完成 / 已駁回 / 已作廢):任何一個表單模組都可能被綁流程。表單自訂欄位不能進條件。
- 模組本身與權限是種子資料;**沒有種子表單、種子流程** —— 由平台在「表單管理」「流程管理」建、分派給租戶。

## api 介面

全部走表單引擎的執行端點(`moduleForms`、`formSubmissions`、`formSubmission`、`createFormDraft`、`saveFormDraft`、`submitFormSubmission`、`updateFormSubmission`、`deleteFormSubmission`、`formLookup`、`moduleListColumns`…),形狀、缺席 / `null` 語意、錯誤碼見 [forms「api 介面」](./forms.md#api-介面);審核相關見 [workflows](./workflows.md)。本模組沒有自己的端點。

## 租戶使用者說明

三個示範表單都沒有專屬說明檔,「?」用表單模組通用說明 `apps/admin/src/md/module-help/form-module.help.md`(含審核流程;彈窗標題是各自的模組名)。表單模組不必各放一份說明;有特殊需求才加 `<模組 key>.help.md` 專屬檔,專屬檔優先(對應規則在 `apps/admin/src/lib/module-help.ts` 的 `resolveModuleHelp`)。
