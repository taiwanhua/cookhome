# 模組與權限(技術)

- **模組 key**:`module-manager`(暫定;根組織專屬,租戶不可見)
- **畫面**:Figma「Admin 模組與權限」(左模組樹+右權限清單,除 enabled 外唯讀)
- **相關 ADR**:[0002 種子資料與業務資料](../adr/0002-seed-data-vs-business-data.md)、[0004 權限模型](../adr/0004-permission-model.md)
- **資料**:`modules`(樹)、`permissions`(moduleId 指向擁有模組)
- **權限備忘**:seed 以 key 冪等 upsert;`enabled` 是唯一 runtime 可變欄位,停用父模組 API 連動子樹;新模組走 code+PR(未來 module-scaffold skill);隱藏 `api` 模組掛純 API 權限
- **使用者說明**:[module-manager.help.md](../../apps/admin/src/md/module-help/module-manager.help.md)
