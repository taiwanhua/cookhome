# 角色管理(技術)

- **模組 key**:`role-manager`(暫定)
- **畫面**:Figma「Admin 角色管理」;分頁:權限設定(矩陣+資料範圍 Radio)、分配使用者;彈窗:新增/編輯角色、加入使用者、刪除/停用確認、放棄變更
- **相關 ADR**:[0004 權限模型](../adr/0004-permission-model.md)、[0008 資料範圍](../adr/0008-data-scope.md)
- **資料**:`roles`、`permissions`(kind: action|data-scope)、`core_relationships`(org_role、role_permission、user_role)
- **平台視角(不進 help)**:超級管理員為種子角色、僅根組織可授予;「租戶管理員」角色範本於開通租戶時複製
- **UI**:分配使用者列表、使用者管理列表角色欄、指派角色彈窗,對失去子樹支撐的授予標 Warning Tag「組織外」+ hover 完整說明(暫定 A 案,備選 B:icon + popover;三處示範圖已畫;ADR-0003)
- **權限備忘**:矩陣勾選送出時做 subset-only 防越權驗證;wildcard `模組key.*` 存單筆關聯;資料範圍檔位互斥(radio)、多角色取最寬;分配使用者候選 = 所屬組織落在角色擁有組織子樹內的使用者;授權變更寫 `audit_logs`
- **使用者說明**:[role-manager.help.md](../../apps/admin/src/md/module-help/role-manager.help.md)
