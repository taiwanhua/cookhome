# 購物清單(技術)

> **表單模組的範例**:新開一個「欄位由使用者在後台設計」的模組,照這份與 [module-scaffold 的「表單模組路線」](../agents/module-scaffold.md#表單模組路線)。表單引擎本身的規則在 [forms](./forms.md),概念見 `docs/concepts/form-engine.md`。

## 用途

表單模組(`engine: "form"`)的最小範例:骨架(路由、三個隱藏頁、四筆權限、資料範圍目標)由 seed 宣告,**表單**(欄位、版面、版本、分派、啟用)由平台與租戶在「表單管理」建,頁面四個 key 全用表單引擎的預設組裝。單純填報,送出即完成。

正本:`apps/db-migrator/seeds/modules/shopping-list.ts`

## 模組 key 與畫面

| key                         | 名稱     | sidebarType  | 路由                                   | 自有權限 |
| --------------------------- | -------- | ------------ | -------------------------------------- | -------- |
| `shopping-list`             | 購物清單 | link(列表頁) | `/shopping-list`                       | 見權限表 |
| `shopping-list.view-page`   | 詳情     | hidden       | `/shopping-list/view-page/<id>`        | 僅 `*`   |
| `shopping-list.create-page` | 新增     | hidden       | `/shopping-list/create-page/<formKey>` | 僅 `*`   |
| `shopping-list.edit-page`   | 編輯     | hidden       | `/shopping-list/edit-page/<id>`        | 僅 `*`   |

- 新增頁網址最後一段是**表單 key**:此刻可新增的表單只有一張時列表的新增鈕直接進,多張時先跳選單;網址沒帶表單 key 時同樣處理。
- 四頁在 `apps/admin/src/app/module-pages.tsx` 以 `...formModulePages(SHOPPING_LIST_MODULE_KEY)` 登記,元件在 `apps/admin/src/components/form-engine/FormModulePages/`。
- 頁籤 / 標題 = 模組層模板(預設 `{{title}}`)套摘要槽,表單的 `tabLabelTemplate` 可覆寫。

正本:`apps/db-migrator/seeds/modules/shopping-list.ts`、`apps/admin/src/app/module-pages.tsx`

## 權限表

| 權限 key                                     | moduleId 指向    | 它是哪一頁的什麼                                                  |
| -------------------------------------------- | ---------------- | ----------------------------------------------------------------- |
| `shopping-list.*`                            | 購物清單(列表頁) | wildcard(同層語意);seed 自動產生;也涵蓋發布時建的欄位級權限       |
| `shopping-list.view`                         | 購物清單(列表頁) | 列表與單筆                                                        |
| `shopping-list.create`                       | 購物清單(列表頁) | 新增鈕、建 / 存 / 送 / 刪自己的草稿                               |
| `shopping-list.edit`                         | 購物清單(列表頁) | 修改已完成的提交(每改一次修訂號 +1)                               |
| `shopping-list.delete`                       | 購物清單(列表頁) | 刪除已完成的提交                                                  |
| `shopping-list.show-<formKey>-<fieldKey>` 等 | 購物清單(列表頁) | 欄位級(`source: dynamic`,表單發布時建;規則見 [forms](./forms.md)) |

端點在執行期依這四筆判(`moduleKey` 在 input 或提交上),不是 `@RequirePermission`。逐列的編輯 / 刪除一律看 api 給的 `abilities`。

## 資料

- **提交**存所有表單模組共用的 `form_submissions`(模組資料表),`moduleKey = "shopping-list"`。欄位與索引見 `docs/data-model.md`。
- **資料範圍目標**:`form_submissions` + `shopping-list`(「資料範圍」頁左清單一列「購物清單」,副文字 `form_submissions`);欄位目錄 = 基礎欄位 + 提交狀態(草稿 / 已完成)。表單自訂欄位不能進條件。
- 模組本身與權限是種子資料;**沒有種子表單** —— 表單由平台在「表單管理」建、分派給租戶。

## api 介面

全部走表單引擎的執行端點(`moduleForms`、`formSubmissions`、`formSubmission`、`createFormDraft`、`saveFormDraft`、`submitFormSubmission`、`updateFormSubmission`、`deleteFormSubmission`、`formLookup`、`moduleListColumns`…),形狀、缺席 / `null` 語意、錯誤碼見 [forms「api 介面」](./forms.md#api-介面)。本模組沒有自己的端點。

## 租戶使用者說明

`apps/admin/src/md/module-help/shopping-list.help.md`(表單模組的通用說明,之後的表單模組可照抄)。
