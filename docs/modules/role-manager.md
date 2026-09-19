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

## api 介面(#203;程式正本 `apps/api/src/roles/`、operation 文件 `packages/graphql/src/documents/roles.graphql`)

GQL-06 / GQL-07:可選輸入欄位的「缺席 / null」語意與回傳欄位語意的正本在本節,前端段只引用、不另寫解釋。

| 端點                                                  | 權限 key         | 說明                                                                                       |
| ----------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| `roles(input: RolesInput!): RolesPayload!`            | `view`           | 範圍 = 擁有組織在操作者**管理範圍**內的角色;`keyword` 比對名稱與描述(不分大小寫的部分比對) |
| `role(id: ID!): RolePayload!`                         | `view`           | 單筆;管理範圍外視同不存在(`NOT_FOUND`,不透露差別)                                          |
| `createRole(input: CreateRoleInput!): RolePayload!`   | `create`         | 擁有組織限管理範圍內(範圍外 `FORBIDDEN`);新角色不綁任何模組 / 權限                         |
| `updateRole(input: UpdateRoleInput!): RolePayload!`   | `edit`           | 只有名稱與描述;**擁有組織建立後不可改**(改管轄邊界等於換一個角色,ADR-0003)                 |
| `setRoleEnabled(input: …): RolePayload!`              | `toggle-enabled` | 種子角色與租戶副本**照樣可停用**(可逆);「不可刪」才是保護                                  |
| `deleteRole(input: DeleteRoleInput!): DeletePayload!` | `delete`         | 前置三項不過 → `ROLE_NOT_DELETABLE` + `extensions.reasons`;軟刪除,關聯不動                 |
| `roleMatrix(roleId: ID!): RoleMatrixPayload!`         | `view`           | 見下方「矩陣的兩棵樹」                                                                     |
| `saveRoleMatrix(input: …): RoleMatrixPayload!`        | `edit-matrix`    | 整份覆蓋(限矩陣回的那棵樹);`ROLE_OUT_OF_REACH`                                             |
| `roleUsers(roleId: ID!, input: …): RoleUsersPayload!` | `view`           | 被授予這個角色的**所有人**(含管理範圍外的「組織外」持有者 — 列不出來就移不掉)              |
| `grantRoleUsers(input: …): RoleUsersPayload!`         | `assign-users`   | **增量加入**(不是全量覆蓋);候選外 → `USER_NOT_ELIGIBLE`;已持有者重送冪等                   |
| `revokeRoleUsers(input: …): RoleUsersPayload!`        | `assign-users`   | 擁有者保護 → `OWNER_PROTECTED`;未持有者重送冪等                                            |

**缺席 / null 的語意**(GQL-06):

- `CreateRoleInput.ownerOrgId`:**缺席與 `null` 同義** — 都取操作者的當前組織
- `UpdateRoleInput.name`:缺席 / `null` = 不動(名稱不可清空)
- `UpdateRoleInput.description`:**缺席 = 不動、`null` = 清空**(空字串同 `null`)

**回傳欄位的語意**(GQL-07):

- `Role.ownerOrg`:擁有組織;清單只回管理範圍內的角色,所以正常恆有值,資料損毀(無 `org_role`)時為 `null`
- `Role.isSystem`:種子角色(`super-admin` / `tenant-admin` 模板);`Role.isTemplateCopy`:開通租戶複製出來的副本(`settings.templateKey`,ADR-0009)。兩者都不可刪,後者的矩陣另外**只能縮不能擴**
- `Role.userCount`:被授予的人數,**含「組織外」的授予**(ADR-0003:授予照常有效)
- `RoleUser.orgs`:該使用者的所屬組織,只列操作者管理範圍內的(範圍外的連 id 都不露)
- `RoleUser.outOfScope`:所屬組織皆不在角色擁有組織的子樹內 → UI 標 Warning Tag「組織外」
- `RoleUser.ownerProtected`:移除會被 `OWNER_PROTECTED` 擋下 → UI 把「移除」設為 disabled
- `RoleMatrixPayload.shrinkOnly`:這個角色是租戶管理員副本,矩陣只能縮不能擴
- `RoleMatrixPayload.granted`:**已展開 `*`**(含 `*` 本身與展開後的同層各筆),直接餵 `@repo/domain/permission` 的連動純函式

**矩陣的兩棵樹**(#203 的實作決定;規則來源 ADR-0004 防越權 + ADR-0011 的 enabled 剔除):

- 後端內部以**全樹**(全部 enabled 模組 + 各模組全部 enabled 權限)做 `normalizeGrant` / `isSubsetOf`。
  `*` 的收斂語意是「這一層的每一筆都給了」,拿一棵被裁過的樹去收斂會讓「只看得到 5 筆、勾滿 5 筆」
  被存成 `*` 而擴權 — 所以比對基準一定是全樹。
- `roleMatrix.modules` 回的是**顯示樹** = 全樹 ∩ 操作者自身的有效權限集(超級管理員 = 全部)。
  矩陣上沒出現的就是勾不到的,前端不必自己再算一次防越權。
- `saveRoleMatrix` 的整份覆蓋**只作用在顯示樹的範圍**:操作者搆不到的既有綁定不被清掉
  (與 `assignUserRoles`「操作者觸及不到的既有授予不動」同一條原則)。
