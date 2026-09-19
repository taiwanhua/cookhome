# 資料範圍(技術)

- **模組 key**:`system.data-scope`(掛系統管理群組,**根組織專屬**,租戶不可見)
- **畫面**:Figma「Screen / Admin 資料範圍」— 左資料目標清單、右規則編輯器;合成規則說明見畫布旁註記卡
- **相關 ADR**:[0008 資料範圍](../adr/0008-data-scope.md)(機制本體)、[0011 查詢與判斷流程](../adr/0011-permission-resolution-flow.md)
- **資料**:`data_scope_rules`(collection unique、combineOp、rules[{audience, filter}])
- **資料目標來源**:各模組 seed 的 `dataScopeTarget` 宣告(collection、中文名、描述、可篩欄位);基礎欄位由底座自動掛進欄位目錄
- **執行**:BaseRepository 查詢時套用 — 命中規則依 combineOp 合成,最外層恆 AND 租戶隔離保底;設定記憶體快取、儲存時作廢
- **UI 規則**:條件列 = 欄位(依目錄)→ 運算子(依型別)→ 值(依值來源,含動態值【操作者本人】【操作者的所屬組織】);巢狀群組任意深、UI 呈現建議 3 層;每層與頂層各有 AND/OR 切換
- **權限備忘**:整頁根組織專屬;未來若開放租戶,套用對象與值選擇器已天然受可見範圍限制,保底不可關
- **使用者說明**:[system.data-scope.help.md](../../apps/admin/src/md/module-help/system.data-scope.help.md)(根組織專屬模組 — help 讀者即系統管理員,可用平台詞彙)

## 權限表(第 4 段前置,2026-09-20)

每個模組固定有一筆 `<key>.*`(seed 自動產生,本表不列)。綁定原則:綁「按鈕 / 欄位所在的那一頁」(ADR-0004)。

| 權限 key                 | 它是哪一頁的什麼                                                           |
| ------------------------ | -------------------------------------------------------------------------- |
| `system.data-scope.view` | 看資料目標清單與各目標的規則                                               |
| `system.data-scope.edit` | 規則編輯器「儲存」+ API(整份 `data_scope_rules` 覆蓋;儲存即作廢記憶體快取) |

執行面(第 4 段做):BaseRepository 對**業務類** collection(`tenantScopePlugin({ kind: "business" })`)套規則;第一個目標是示範模組1 的 `demo_items_one`;`users` / `orgs` 這類底座資料不做資料範圍。審計動作:`data-scope.edit`(`targetType = "data_scope_rule"`,`targetId` 為該 collection 的規則文件)。
