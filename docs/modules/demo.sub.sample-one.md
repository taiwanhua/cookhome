# 示範模組1(技術)

**示範家族的目的**:①底座模板 — module-scaffold 產新模組的藍本 ②權限測試場(劇本見 [docs/testing/permission-scenarios.md](../testing/permission-scenarios.md))③新專案 bootstrap 後的活教材。家族含兩個模組:本篇(完整示範)與 [示範模組2](./demo.sample-two.md)(對照組)。

## 家族模組樹

可進入 = 角色綁了該模組(`role_module`,ADR-0011);矩陣 UI 保證勾下層必連動上層。

| key | 名稱 | sidebarType | 自有權限 |
|---|---|---|---|
| `demo` | 示範群組 | group | 無 |
| `demo.sub` | 示範次群組 | group | 無 |
| `demo.sub.sample-one` | 示範模組1 | link(列表頁) | 見權限表 |
| `demo.sub.sample-one.view-page` | 示範項目詳情 | hidden | 無 |
| `demo.sub.sample-one.create-page` | 新增示範項目 | hidden | `show-tips` |
| `demo.sub.sample-one.edit-page` | 編輯示範項目 | hidden | `show-history` |
| `demo.sample-two` 一支 | 見 [示範模組2](./demo.sample-two.md) | | |

`delete` 無對應頁(列表動作+確認彈窗)— 權限與頁面不必一一對應,本身即示範。

## 權限表(綁定原則:綁「按鈕/欄位所在的那一頁」,ADR-0004)

| 權限 key | moduleId 指向 | 它是哪一頁的什麼 |
|---|---|---|
| `demo.sub.sample-one.*` | 示範模組1(列表頁) | wildcard,代表整組(role_permission 只存這一筆) |
| `demo.sub.sample-one.view` | 示範模組1(列表頁) | 看列表與單筆資料、進入檢視頁/打開檢視跳窗 |
| `demo.sub.sample-one.create` | 示範模組1(列表頁) | 進入新增頁的按鈕 + 新增 API |
| `demo.sub.sample-one.edit` | 示範模組1(列表頁) | 進入編輯頁的按鈕 + 編輯 API |
| `demo.sub.sample-one.delete` | 示範模組1(列表頁) | 列表的刪除按鈕 + 刪除 API |
| `demo.sub.sample-one.show-internal-note` | 示範模組1(列表頁=父) | 跨頁共用欄位:內部備註可見(詳情+編輯) |
| `demo.sub.sample-one.edit-internal-note` | 示範模組1(列表頁=父) | 同上(可改;無此權限硬送寫入 → API 拒) |
| `demo.sub.sample-one.create-page.show-tips` | 新增頁 | 頁面自有示範:填寫提示區塊 |
| `demo.sub.sample-one.edit-page.show-history` | 編輯頁 | 頁面自有示範:變更歷程區塊 |

## 資料

**demo_items_one**:name、category(欄位管理「示範分類」選項)、note、internalNote(欄位級權限控)、coverPath(公開 bucket)、attachmentPath(私有 bucket)、enabled + 基礎欄位(ADR-0007)。

**資料範圍(ADR-0008)**:seed 宣告 `dataScopeTarget`(collection=demo_items_one,可篩欄位=基礎欄位即足)。

連動 seed:欄位管理新增全域類別「示範分類」+ 數個選項。

## Seed 與環境

全環境灌;production 預設 `enabled=false`;納入租戶管理員模板。help:`apps/admin/src/md/module-help/demo.sub.sample-one.help.md`。畫面規劃見 dis.md #20。
