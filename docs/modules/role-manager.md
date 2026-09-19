# 角色管理(技術)

- **模組 key**:`system.role-manager`
- **畫面**:Figma「Admin 角色管理」;分頁:權限設定(矩陣+資料範圍 Radio)、分配使用者;彈窗:新增/編輯角色、加入使用者、刪除/停用確認、放棄變更
- **相關 ADR**:[0004 權限模型](../adr/0004-permission-model.md)、[0011 查詢與判斷流程](../adr/0011-permission-resolution-flow.md)
- **資料**:`roles`、`permissions`(moduleId 指向擁有模組)、`core_relationships`(org_role、role_module、role_permission、user_role)
- **平台視角(不進 help)**:超級管理員為種子角色、僅根組織可授予;「租戶管理員」角色範本於開通租戶時複製
- **UI**:分配使用者列表、使用者管理列表角色欄、指派角色彈窗,對失去子樹支撐的授予標 Warning Tag「組織外」+ hover 完整說明(暫定 A 案,備選 B:icon + popover;三處示範圖已畫;ADR-0003)
- **權限矩陣規則(Figma 已重畫,dis.md #20)**:依模組層級顯示樹,模組粗體、可勾選(勾模組=給路由);勾下層模組必連動勾上層,有子孫被勾的上層為勾選且不可取消;各模組的權限縮排列於其下,每個模組都有一列「全部(`*`)」與同層權限互斥連動(勾 `*` 同層全勾;取消任一則 `*` 取消,改存個別筆)— **`*` 只代表該模組自己這層**(ADR-0004 同層語意);頂層模組列旁一顆狀態切換按鈕「全選整組 / 清空整組」= 對子樹**每個模組**寫入或清除 `*`,群組列的勾選狀態是衍生的(子樹全部有 `*` 才顯示勾),不另存
- **擁有組織 = 管轄邊界**(ADR-0003「擁有組織 = 角色的管轄邊界」):新增角色時選擁有組織(預設當前組織,限操作者管理範圍內),欄位下固定提示「這個角色的持有者可以管理此組織與它底下的所有組織」;要不同範圍就建不同角色
- **權限備忘**:矩陣勾選送出時做 subset-only 防越權驗證(模組與權限皆是;持有某模組 `*` 才能授出該模組的權限);分配使用者候選 = 所屬組織落在角色擁有組織子樹內的使用者;授權變更由本模組寫 `audit_logs`(RelationService 不記)
- **使用者說明**:[system.role-manager.help.md](../../apps/admin/src/md/module-help/system.role-manager.help.md)

## 權限表(第 4 段前置,2026-09-20)

每個模組固定有一筆 `<key>.*`(seed 自動產生,本表不列)。綁定原則:綁「按鈕 / 欄位所在的那一頁」(ADR-0004)。

| 權限 key                             | 它是哪一頁的什麼                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `system.role-manager.view`           | 看角色清單、單筆(權限矩陣、分配使用者兩個頁籤);沒有它整頁進不去內容                                   |
| `system.role-manager.create`         | 「新增角色」按鈕 + API(擁有組織限操作者管理範圍內,預設當前組織)                                       |
| `system.role-manager.edit`           | 編輯名稱 / 描述 + API                                                                                 |
| `system.role-manager.edit-matrix`    | 權限矩陣「儲存」+ API(role_module / role_permission 整份覆蓋;subset-only 防越權;租戶副本只能縮不能擴) |
| `system.role-manager.assign-users`   | 分配使用者頁籤的「加入使用者」「移除」+ API(user_role;候選 = 所屬組織在角色擁有組織子樹內)            |
| `system.role-manager.toggle-enabled` | 停用 / 啟用角色 + API(停用後持有者的該角色立即不生效,PermissionResolver 已排除 enabled=false)         |
| `system.role-manager.delete`         | 刪除角色 + API(前置:無授予、非種子角色、非租戶副本;軟刪除)                                            |

審計動作:`role.create` / `role.edit` / `role.edit-matrix`(before / after 為綁定差異)/ `role.grant-user` / `role.revoke-user` / `role.toggle-enabled` / `role.delete`。
