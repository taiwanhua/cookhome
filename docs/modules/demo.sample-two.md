# 示範模組2(技術)

示範家族的**對照組** — 目的、家族模組樹、測試劇本見 [示範模組1](./demo.sub.sample-one.md)。本篇只寫差異。

## 與示範模組1 的差異

- 掛在示範群組(`demo`)直下,不經次群組 — 示範兩層結構。
- **不宣告 `dataScopeTarget`**:查詢僅受可見範圍保底,驗證資料範圍規則未介入時的行為(ADR-0008)。
- 無欄位級與頁面自有權限,只有基本五筆。

## 模組節點

| key | 名稱 | sidebarType | 自有權限 |
|---|---|---|---|
| `demo.sample-two` | 示範模組2 | link(列表頁) | 見下 |
| `demo.sample-two.view-page` / `.create-page` / `.edit-page` | 詳情/新增/編輯 | hidden | 無 |

## 權限表

`demo.sample-two.*`、`.view`、`.create`、`.edit`、`.delete` 共 5 筆,全綁示範模組2(列表頁);語意與示範模組1 對應權限相同。

## 資料

**demo_items_two**:name、note、enabled + 基礎欄位(ADR-0007)。

## Seed 與環境

同示範模組1。help:`apps/admin/src/md/module-help/demo.sample-two.help.md`。
