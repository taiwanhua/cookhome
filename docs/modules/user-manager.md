# 使用者管理(技術)

- **模組 key**:`system.user-manager`
- **畫面**:左組織樹 + 右表格;彈窗:新增/編輯使用者、選擇所屬組織(勾選=加入、取消=移除)、確認所屬組織變更(含移除時必出,radio 三檔)、指派角色、停用確認
- **相關 ADR**:[0003](../adr/0003-dual-account-system.md)(帳號、授予、移除)、[0004](../adr/0004-permission-model.md)、[0007](../adr/0007-base-fields-and-data-protection.md)
- **資料**:`users`、`core_relationships`(org_user、user_role)
- **清單範圍**:查詢組織子樹 ∩ 操作者可見組織集;組織樹以租戶頂層為根,範圍外節點 disabled
- **移除所屬組織**:radio 三檔 + dry-run,規則見 ADR-0003;角色欄以「組織外」標示失去擁有組織子樹支撐的角色授予(UI 文案用白話;樣式見 Figma)
- **密碼流程**:「設定新密碼」頁共用三入口 — 啟用信(7 天)、重設信(30 分鐘)、首登強改(mustChangePassword);連結失效頁導向忘記密碼自助;`action_tokens` 見 ADR-0009/0010
- **使用者說明**:[system.user-manager.help.md](../../apps/admin/src/md/module-help/system.user-manager.help.md)
