# 欄位管理(技術)

- **模組 key**:`field-manager`(暫定)
- **畫面**:Figma「Admin 欄位管理」(左類別清單+右選項表格,種子資料標示)
- **相關 ADR**:[0002 種子資料與業務資料](../adr/0002-seed-data-vs-business-data.md)、[0005 多租戶隔離](../adr/0005-multi-tenant-isolation.md)
- **資料**:`field_categories`(全域 seed)、`fields`(orgId nullable:null=全域 seed、有值=租戶自訂)
- **UI 規格**:「來源」欄顯示「全域」或「<組織名稱> 自訂」(2026-09-09 定案;不用「租戶自訂」— 下層組織也可能自訂,且租戶為平台詞彙)
- **權限備忘**:新增類別走 code+PR(seed 冪等 upsert);seed 選項僅 `enabled` 可改;租戶自訂選項限本租戶可見;選項不可刪(舊資料對照),僅停用
- **使用者說明**:[field-manager.help.md](../../apps/admin/src/md/module-help/field-manager.help.md)
