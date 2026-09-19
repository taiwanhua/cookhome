# 模組與權限(技術)

- **模組 key**:`system.module-manager`(根組織專屬,租戶不可見)
- **畫面**:Figma「Admin 模組與權限」(左模組樹+右權限清單,除 enabled 外唯讀)
- **相關 ADR**:[0002 種子資料與業務資料](../adr/0002-seed-data-vs-business-data.md)、[0004 權限模型](../adr/0004-permission-model.md)
- **資料**:`modules`(樹)、`permissions`(moduleId 指向擁有模組)
- **權限備忘**:seed 以 key 冪等 upsert;`enabled` 是唯一 runtime 可變欄位,停用父模組 API 連動子樹;新模組走 code+PR(未來 module-scaffold skill);隱藏 `api` 模組掛純 API 權限
- **使用者說明**:[system.module-manager.help.md](../../apps/admin/src/md/module-help/system.module-manager.help.md)

## 權限表(第 4 段前置,2026-09-20)

每個模組固定有一筆 `<key>.*`(seed 自動產生,本表不列)。綁定原則:綁「按鈕 / 欄位所在的那一頁」(ADR-0004)。

| 權限 key                               | 它是哪一頁的什麼                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `system.module-manager.view`           | 看模組樹與各模組的權限清單(唯讀)                                                                                                                       |
| `system.module-manager.toggle-enabled` | 模組 / 權限的 `enabled` 切換 + API(停用父模組連動整棵子樹;停用權限 = 全域 kill switch,連超級管理員也不給;停用確認彈窗 Figma「Overlay / 停用模組確認」) |

模組本身 `isRootOnly`(seed 層),租戶模板不含;審計動作:`module.toggle-enabled` / `permission.toggle-enabled`(`targetType` 分別為 `module` / `permission`)。
