# 組織管理(技術)

- **模組 key**:`org-manager`(暫定)
- **畫面**:Figma「Admin 組織管理」+ 租戶視角變體;彈窗:開通租戶、新增子組織、編輯組織、停用確認
- **相關 ADR**:[0005 多租戶隔離](../adr/0005-multi-tenant-isolation.md)、[0009 租戶開通](../adr/0009-tenant-provisioning.md)
- **資料**:`orgs`(ancestors 物化路徑、tenant-top 可見性開關、logoPath 商標路徑)、`core_relationships`
- **商標上傳**:開通租戶與編輯組織彈窗皆含 `Draft/UploadField`(選填);SideNav 顯示邏輯見 docs/branding.md
- **權限備忘**:開通租戶為根組織專屬權限;搬移限同租戶(驗 ancestors);停用/啟用連動整棵子樹;刪除前置檢查:無子組織、無關聯資料

## 平台視角(不進 help)

- 整體結構:平台(根組織)> 各租戶 > 部門/分店;開通流程與 token 規則見 ADR-0009
- 搬移僅限同租戶,跨租戶禁止
- 「使用者可見下層組織資料」開關實際掛在租戶頂層、套用整個租戶 — help 對租戶只說「頂層組織」「整個組織」

## help 邊界

[org-manager.help.md](../../apps/admin/src/md/module-help/org-manager.help.md)(build 時打包進說明彈窗)讀者是租戶使用者:不得出現 根組織/租戶/開通/跨租戶 等平台視角詞彙;租戶眼中的根 = 自己的頂層組織。
