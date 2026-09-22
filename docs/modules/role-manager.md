# 角色管理(技術)

- **模組 key**:`system.role-manager`
- **畫面**:Figma「Admin 角色管理」;分頁:權限設定(矩陣+資料範圍 Radio)、分配使用者;彈窗:新增/編輯角色、加入使用者、刪除/停用確認、放棄變更
- **相關 ADR**:[0004 權限模型](../adr/0004-permission-model.md)、[0011 查詢與判斷流程](../adr/0011-permission-resolution-flow.md)
- **資料**:`roles`、`permissions`(moduleId 指向擁有模組)、`core_relationships`(org_role、role_module、role_permission、user_role)
- **平台視角(不進 help)**:超級管理員為種子角色、僅根組織可授予;「租戶管理員」角色範本於開通租戶時複製
- **UI**:分配使用者列表、使用者管理列表角色欄、指派角色彈窗,對失去子樹支撐的授予標 Warning Tag「組織外」+ hover 完整說明(暫定 A 案,備選 B:icon + popover;三處示範圖已畫;ADR-0003)
- **權限矩陣規則(Figma 已重畫,dis.md #20)**:規則逐條列在下方「權限矩陣規則(逐條)」節,實作與測試一律引用該節的編號
- **擁有組織 = 管轄邊界**(ADR-0003「擁有組織 = 角色的管轄邊界」):新增角色時選擁有組織(預設當前組織,限操作者管理範圍內),欄位下固定提示「這個角色的持有者可以管理此組織與它底下的所有組織」;要不同範圍就建不同角色
- **權限備忘**:矩陣勾選送出時做 subset-only 防越權驗證(模組與權限皆是;**持有 `X.*` 可授出 X 這層任何權限與 `X.*`;只持有個別筆的可授出該筆,但不可授出 `*`** — 措辭與 ADR-0004「防越權與稽核」一致,不是「有 `*` 才能授出」);分配使用者候選 = 所屬組織落在角色擁有組織子樹內的使用者;授權變更由本模組寫 `audit_logs`(RelationService 不記)
- **詞彙對應**:文件的「租戶副本」(`Role.isTemplateCopy`,開通租戶時複製的租戶管理員副本)在 **UI 與 help.md 一律稱「預設角色」**(租戶使用者看得到的畫面不出現平台視角詞彙,FIGMA-04);技術文件與模型一律用「租戶副本」
- **使用者說明**:[system.role-manager.help.md](../../apps/admin/src/md/module-help/system.role-manager.help.md)

## 角色種類與可改動範圍(2026-09-21 / #261)

規則正本 [ADR-0004「角色種類與可改動範圍」](../adr/0004-permission-model.md);本節補模組側的錯誤碼與落點。
三種判準互斥,由上往下取第一個成立者。api 依**操作者**算好 `Role.kind`(`SYSTEM` / `TEMPLATE_COPY` / `CUSTOM`)與 `Role.abilities`(`canEdit` / `canEditMatrix` / `canToggleEnabled` / `canDelete`),**前端只讀、不重算**。

| 角色種類                             | 判準                             | 改名 / 描述 | 權限矩陣                                                             | 停用                                | 刪除       | 分配使用者 |
| ------------------------------------ | -------------------------------- | ----------- | -------------------------------------------------------------------- | ----------------------------------- | ---------- | ---------- |
| **種子**(超級管理員、租戶管理員模板) | `isSystem`(seed runner 一律補齊) | 不可        | 唯讀                                                                 | 不可                                | 不可       | 可         |
| **預設角色**(租戶副本)               | `settings.templateKey`           | 租戶可      | **上限 = 內建租戶管理員模板** — root:模板範圍內放寬 / 收窄;租戶:收窄 | 只有 root(自鎖保護)                 | 不可       | 可         |
| **自建角色**                         | 其餘                             | 可          | 依 subset-only                                                       | 可,但不可停用操作者自己正持有的角色 | 無授予時可 | 可         |

被擋下時的錯誤碼(GQL-04 的表由 #261 同步):

| 情境                                    | 回應                                          |
| --------------------------------------- | --------------------------------------------- |
| 動到種子角色(改名 / 矩陣 / 停用 / 刪除) | `FORBIDDEN`,reason `SYSTEM_ROLE`              |
| 非 root 停用預設角色                    | `FORBIDDEN`,reason `TEMPLATE_COPY_ROOT_ONLY`  |
| 停用操作者自己正持有的角色              | `FORBIDDEN`,reason `SELF_LOCK`                |
| 自建角色仍有授予時刪除                  | `ROLE_NOT_DELETABLE` + `extensions.reasons`   |
| 預設角色勾到模板沒有的項目(root 也擋)   | `ROLE_OUT_OF_REACH`,reason `TEMPLATE_CEILING` |

- `saveRoleMatrix` 的 `shrinkOnly` 判準是「**非 root 且是預設角色**」— root 對預設角色可以放寬,但放寬不出模板的範圍(下一條)。
- **預設角色的天花板**(#283,規則正本 ADR-0004):上限 = 內建「租戶管理員」模板角色**目前**的 `role_module` / `role_permission`,讀出後 `normalizeGrant` 到全樹。`saveRoleMatrix` 對 `TEMPLATE_COPY` 多一道 `isSubsetOf(desired, templateGrant)`,不符 → `ROLE_OUT_OF_REACH` + `reason TEMPLATE_CEILING`。判斷順序是 subset-only → 天花板 → `shrinkOnly`,所以「自己也沒有」與「模板沒有」分得出來。要替租戶開模板外的模組,改 `apps/db-migrator/seeds/role-bindings.ts` 的模板綁定,不是逐個租戶放寬。
- 模組側是同一條自鎖原則:`setModuleEnabled` / `setPermissionEnabled` 打到 `system.module-manager` 子樹或其權限 → `FORBIDDEN`(reason `SELF_LOCK`),見 [module-manager.md](./module-manager.md)。
- UI 落點:清單列的編輯 / 停用 / 刪除按鈕讀 `abilities`;種子角色的矩陣唯讀並說明「系統內建角色,內容隨版本更新」。
- 本節取代下方「api 介面」節 `setRoleEnabled` 原本「種子角色與租戶副本照樣可停用」的說法(該節由 #261 同步)。

## 權限矩陣規則(逐條)

原本是一長行,2026-09-20(#212)依 #202 / #203 / #208 的實作與測試拆成編號小節;
純函式正本 `@repo/domain/permission`(`matrix.ts`),`matrix.test.ts` 的案名逐條對應本節。
畫面:依模組層級顯示樹,模組粗體、可勾選(**勾模組 = 給路由**);各模組的權限縮排列於其下。

| 編號     | 規則                                                                                                                                                                                                                                                                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M-01** | **勾下層補上層**:勾下層模組必連動勾上層;**勾一筆權限也要補上它的擁有模組與各層祖先**(模組沒綁時該權限是死資料,ADR-0011 先取模組再掛權限)。不是把權限丟掉(#202)                                                                                                                                                                           |
| **M-02** | **有子孫被勾的上層為勾選且不可取消**:UI 上該列勾選框 `disabled` 但**整列仍可展開**(`@repo/ui/tree` 的 `disabledCheckIds`,#207);要整棵收掉用「清空整組」或先取消下層                                                                                                                                                                      |
| **M-03** | **`*` 與同層互斥連動**:勾「全部(`*`)」→ 同層每一筆跟著勾;取消其中任一筆 → `*` 解除、改存其餘個別筆。**`*` 只代表該模組自己這一層**(ADR-0004 同層語意),不涵蓋子模組                                                                                                                                                                       |
| **M-04** | **收斂只存 `*` 一筆**:同層全勾時 `role_permission` 只存 `<模組>.*`;已持有 `*` 恆維持 `*`(`*` 含未來新增)                                                                                                                                                                                                                                 |
| **M-05** | **整組全選 / 清空**:頂層群組列旁的切換 = 對子樹**每個模組**寫入 `*`(並勾上模組)/ 清除 `*`;**清空同時清掉子樹的模組勾選**,不只清 `*`(只清 `*` 會留下一排仍被勾的模組,與按鈕字面不符,#202)。子樹以外不受影響                                                                                                                               |
| **M-06** | **群組列的勾選狀態是衍生的**:子樹每個模組都有 `*` 才顯示勾,**不另存**群組層級的記錄                                                                                                                                                                                                                                                      |
| **M-07** | **沒有個別權限的模組**(群組、`api` 容器、純權限容器):同層是空集合,**只有明確勾了 `*` 才存**;不可因「同層全勾」而自動生出 `*`(否則每次正規化都無中生有,#202)                                                                                                                                                                              |
| **M-08** | **三態 indeterminate 的定義**:**模組已勾、且它的直接子列(子模組 + 這一層的權限)只勾了一部分** → 該列顯示 mixed(`aria-checked="mixed"`)。連動一律由呼叫端算,`@repo/ui/tree` 只負責呈現(#207 / #208)                                                                                                                                       |
| **M-09** | **收斂與 subset 比對的基準是全樹**,不是裁成操作者權限集的顯示樹(ADR-0004「儲存」;細節見下方「矩陣的兩棵樹」)                                                                                                                                                                                                                             |
| **M-10** | **樹上沒有 `*` 列的模組就是沒有 `*`**(#363):矩陣只替「這一層列得出權限」的模組推導 `<模組>.*`;整層一筆權限都沒有時,整組全選不寫 `*`、群組列的勾選狀態也不要求它,硬送進來的 `<模組>.*` 依 M-01 的「樹外 key 一律丟棄」處理。顯示樹會把操作者搆不到的 `*` 列剪掉,生出來的那一筆使用者**看不到也取消不掉**,送出只會換來 `ROLE_OUT_OF_REACH` |

## 權限表(第 4 段前置,2026-09-20)

每個模組固定有一筆 `<key>.*`(seed 自動產生,本表不列)。綁定原則:綁「按鈕 / 欄位所在的那一頁」(ADR-0004)。

| 權限 key                             | 它是哪一頁的什麼                                                                                                                                                                                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `system.role-manager.view`           | 看角色清單、單筆(權限矩陣、分配使用者兩個頁籤);沒有它整頁進不去內容                                                                                                                                                                                                                                     |
| `system.role-manager.create`         | 「新增角色」按鈕 + API(擁有組織限操作者管理範圍內,預設當前組織)                                                                                                                                                                                                                                         |
| `system.role-manager.edit`           | 編輯名稱 / 描述 + API                                                                                                                                                                                                                                                                                   |
| `system.role-manager.edit-matrix`    | 權限矩陣「儲存」+ API(role_module / role_permission 整份覆蓋;subset-only 防越權;租戶副本只能縮不能擴)                                                                                                                                                                                                   |
| `system.role-manager.assign-users`   | 分配使用者頁籤的「加入使用者」「移除」+ API(user_role;候選 = 所屬組織在角色擁有組織子樹內)                                                                                                                                                                                                              |
| `system.role-manager.toggle-enabled` | 停用 / 啟用角色 + API(停用後持有者的該角色立即不生效,PermissionResolver 已排除 enabled=false)。**有這個權限不代表每個角色都切得動** — 還要過角色種類規則:種子不可切、預設角色只有 root、不可停用操作者自己正持有的角色(見上方「角色種類與可改動範圍」;列上顯示與否讀 `Role.abilities.canToggleEnabled`) |
| `system.role-manager.delete`         | 刪除角色 + API(前置:無授予、非種子角色、非租戶副本;軟刪除)                                                                                                                                                                                                                                              |

審計動作:`role.create` / `role.edit` / `role.edit-matrix`(before / after 為綁定差異)/ `role.grant-user` / `role.revoke-user` / `role.toggle-enabled` / `role.delete`。

## api 介面(#203;程式正本 `apps/api/src/roles/`、operation 文件 `packages/graphql/src/documents/roles.graphql`)

GQL-06 / GQL-07:可選輸入欄位的「缺席 / null」語意與回傳欄位語意的正本在本節,前端段只引用、不另寫解釋。

| 端點                                                                    | 權限 key         | 說明                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `roles(input: RolesInput!): RolesPayload!`                              | `view`           | 範圍 = 擁有組織在操作者**管理範圍**內的角色;`keyword` 比對名稱與描述(不分大小寫的部分比對);`ownerOrgId` 見下方「缺席 / null 的語意」                                                                                                                    |
| `role(id: ID!): RolePayload!`                                           | `view`           | 單筆;管理範圍外視同不存在(`NOT_FOUND`,不透露差別)                                                                                                                                                                                                       |
| `createRole(input: CreateRoleInput!): RolePayload!`                     | `create`         | 擁有組織限管理範圍內(範圍外 `FORBIDDEN`);新角色不綁任何模組 / 權限                                                                                                                                                                                      |
| `updateRole(input: UpdateRoleInput!): RolePayload!`                     | `edit`           | 只有名稱與描述;**擁有組織建立後不可改**(改管轄邊界等於換一個角色,ADR-0003);種子角色 → `FORBIDDEN`(reason `SYSTEM_ROLE`)                                                                                                                                 |
| `setRoleEnabled(input: …): RolePayload!`                                | `toggle-enabled` | 依角色種類擋(上方「角色種類與可改動範圍」):種子角色一律不可切 → `FORBIDDEN`(`SYSTEM_ROLE`);預設角色(租戶副本)只有根組織的操作者可切 → `FORBIDDEN`(`TEMPLATE_COPY_ROOT_ONLY`);**不可停用操作者自己正持有的角色** → `FORBIDDEN`(`SELF_LOCK`,啟用不受此限) |
| `deleteRole(input: DeleteRoleInput!): DeletePayload!`                   | `delete`         | 前置三項不過 → `ROLE_NOT_DELETABLE` + `extensions.reasons`;軟刪除,關聯不動                                                                                                                                                                              |
| `roleMatrix(roleId: ID!): RoleMatrixPayload!`                           | `view`           | 見下方「矩陣的兩棵樹」                                                                                                                                                                                                                                  |
| `saveRoleMatrix(input: …): RoleMatrixPayload!`                          | `edit-matrix`    | 整份覆蓋(限矩陣回的那棵樹);`ROLE_OUT_OF_REACH`(預設角色超過模板天花板時附 `reason TEMPLATE_CEILING`,#283);種子角色的矩陣唯讀 → `FORBIDDEN`(`SYSTEM_ROLE`)                                                                                               |
| `roleUsers(roleId: ID!, input: …): RoleUsersPayload!`                   | `view`           | 被授予這個角色的**所有人**(含管理範圍外的「組織外」持有者 — 列不出來就移不掉)                                                                                                                                                                           |
| `roleUserCandidates(roleId: ID!, input: …): RoleUserCandidatesPayload!` | `assign-users`   | 「加入使用者」彈窗的候選:操作者**管理範圍**內、**尚未持有**這個角色的人,每筆附 `eligible`;`keyword` 比對姓名 / 帳號 / Email。角色在管理範圍外 → `NOT_FOUND`                                                                                             |
| `grantRoleUsers(input: …): RoleUsersPayload!`                           | `assign-users`   | **增量加入**(不是全量覆蓋);候選外 → `USER_NOT_ELIGIBLE` + `extensions.roleId` / `ownerOrgName`;已持有者重送冪等。資格判斷與使用者頁的 `assignUserRoles` 共用 `OrgQualificationService.assertEligible`(#261)                                             |
| `revokeRoleUsers(input: …): RoleUsersPayload!`                          | `assign-users`   | 擁有者保護 → `OWNER_PROTECTED`;未持有者重送冪等                                                                                                                                                                                                         |

**缺席 / null 的語意**(GQL-06):

- `RolesInput.ownerOrgId`(#246):**缺席與 `null` 同義** — 不篩,回整個管理範圍。給值時**只比對擁有組織本身,不含子樹**(角色的管轄邊界就是它的擁有組織);指到管理範圍外的組織回**空清單**,不是 `FORBIDDEN` / `NOT_FOUND`(不透露該組織存在)。可與 `keyword` 疊加
- `CreateRoleInput.ownerOrgId`:**缺席與 `null` 同義** — 都取操作者的當前組織
- `UpdateRoleInput.name`:缺席 / `null` = 不動(名稱不可清空)
- `UpdateRoleInput.description`:**缺席 = 不動、`null` = 清空**(空字串同 `null`)

**回傳欄位的語意**(GQL-07):

- `Role.ownerOrg`:擁有組織;清單只回管理範圍內的角色,所以正常恆有值,資料損毀(無 `org_role`)時為 `null`
- `Role.ownerOrg.tenantTop`(#261):擁有組織所屬的**租戶頂層**(`orgs.ancestors[1]`,見 `orgs/org-mapper.ts` 的 `tenantTopIdOf`)。角色選單靠它分組 — 每個租戶都有自己的「租戶管理員」,根組織視角只看角色名稱分不出來。擁有組織本身是租戶頂層時 = 它自己;擁有組織是根組織(種子角色)、或租戶頂層落在操作者管理範圍外時為 `null`
- `Role.kind`(#261):`SYSTEM` / `TEMPLATE_COPY` / `CUSTOM`,判準見上方「角色種類與可改動範圍」。`isSystem` / `isTemplateCopy` 是它的兩個布林投影,留著相容
- `Role.abilities`(#261):`canEdit` / `canEditMatrix` / `canToggleEnabled` / `canDelete` — 這個角色**依種類規則**允許的四個動作,api 依操作者算好(程式正本 `apps/api/src/roles/role-rules.ts`),**前端不重算**。**不含權限 key 的判斷**:「有沒有 `system.role-manager.edit`」由 `@RequirePermission` 與前端的 `usePermissions` 各守一層,顯示按鈕的條件是兩者相乘(`rowAbilityOf`)
- `Role.isSystem`:種子角色(`super-admin` / `tenant-admin` 模板);`Role.isTemplateCopy`:開通租戶複製出來的副本(`settings.templateKey`,ADR-0009)。兩者都不可刪,後者的矩陣對**非根組織的操作者**另外只能縮不能擴
- `Role.userCount`:被授予的人數,**含「組織外」的授予**(ADR-0003:授予照常有效)
- `RoleUser.orgs`:該使用者的所屬組織,只列操作者管理範圍內的(範圍外的連 id 都不露)
- `RoleUserCandidate.eligible`(#246):所屬組織至少一個落在角色擁有組織的子樹內(ADR-0003 的授予資格,與 `RoleUser.outOfScope` 同一份判斷、反向)。**不合格的人照樣回**,由前端 disabled 並就地說明原因 —— 直接不列會讓找不到人的人以為「這個人不見了」,而不知道是資格不符。判定權仍在 api:硬送 `grantRoleUsers` 一樣回 `USER_NOT_ELIGIBLE`
- `RoleUser.outOfScope`:所屬組織皆不在角色擁有組織的子樹內 → UI 標 Warning Tag「組織外」
- `RoleUser.ownerProtected`:移除會被 `OWNER_PROTECTED` 擋下 → UI 把「移除」設為 disabled
- `RoleMatrixPayload.shrinkOnly`:**非 root 且**這個角色是租戶管理員副本,矩陣只能縮不能擴(#261 放寬 root — 平台方本來就該能替租戶開新模組)
- `RoleMatrixPayload.ceiling`(#283):預設角色(租戶副本)的**矩陣上限** = 內建「租戶管理員」模板角色目前的授予,**已展開 `*`、已收到顯示樹內**(與 `granted` 同一套投影);其他種類的角色為 `null`。前端把天花板外的列設成不可勾 —— root 與租戶都套(租戶另受 `shrinkOnly`)
- `RoleMatrixPayload.granted`:**已展開 `*`**(含 `*` 本身與展開後的同層各筆),直接餵 `@repo/domain/permission` 的連動純函式

**矩陣的兩棵樹**(#203 的實作決定;規則來源 ADR-0004 防越權 + ADR-0011 的 enabled 剔除):

- 後端內部以**全樹**(全部 enabled 模組 + 各模組全部 enabled 權限)做 `normalizeGrant` / `isSubsetOf`。
  `*` 的收斂語意是「這一層的每一筆都給了」,拿一棵被裁過的樹去收斂會讓「只看得到 5 筆、勾滿 5 筆」
  被存成 `*` 而擴權 — 所以比對基準一定是全樹。
- `roleMatrix.modules` 回的是**顯示樹** = 全樹 ∩ 操作者自身的有效權限集(超級管理員 = 全部)。
  矩陣上沒出現的就是勾不到的,前端不必自己再算一次防越權。
- `saveRoleMatrix` 的整份覆蓋**只作用在顯示樹的範圍**:操作者搆不到的既有綁定不被清掉
  (與 `assignUserRoles`「操作者觸及不到的既有授予不動」同一條原則)。

## admin 頁面(#208;程式正本 `apps/admin/src/pages/system/RoleManagerPage/`)

左清單(搜尋 + 分頁)+ 右頁籤(權限矩陣 / 分配使用者),Figma「角色管理」44:44。
勾選連動一律呼叫 `@repo/domain/permission`,顯示與計算餵同一棵 `roleMatrix.modules`;
前端不自己拼樹、不自己算防越權。換算的薄殼在 `apps/admin/src/lib/role-matrix-208.ts`。
與 Figma 的逐條差異記在 PR #243,不重複於此。

### 未儲存離開

矩陣有未送出的勾選時,離開前要問。「離開」有兩類,分兩路接:

- **切頁籤、換選角色**:頁面自己攔,跳「放棄變更」確認彈窗。
- **關分頁、重新整理、上一頁**:交給 `beforeunload`,用瀏覽器自己的提示(文案不可控,只求不靜默丟失)。

儲存成功後只精準 invalidate 該角色的 `RoleMatrix` 與 `Roles`(DATA-02 / 04),不整頁重抓。

### `shrinkOnly` 與 `ceiling` 的前端鎖

兩把鎖疊在同一組 `disabledCheckIds` 上(`useRoleMatrix` 的 `lockedIds`),算法同一支
(`lib/role-matrix-208.ts` 的 `rowIdsOutside`:一份授予展開後涵蓋不到的列):

- `RoleMatrixPayload.ceiling` 非 null(= 預設角色,#283)→ 鎖**天花板外的列**並顯示「以系統內建的角色範本為上限」;**root 也鎖**。
- `RoleMatrixPayload.shrinkOnly` 為 true(= 非 root 的預設角色)→ 再鎖**目前沒有勾的列**並顯示「只能縮不能擴」。

兩者都是防呆不是把關 — 判準仍以 api 為準(subset-only → 天花板 → shrinkOnly),見「角色種類與可改動範圍」。

### 自組頁籤

`@repo/ui` 沒有 Tabs 元件,本頁以 `role="tablist"` + text `Button` 自組(Figma 69:655 的 Draft/Tab 沒有對應的現成元件),本票不動 `packages/ui`。
第二個頁面要用同一組頁籤時再抽進 `@repo/ui`。

### 三態 indeterminate 的來源

mixed 的定義是 M-08(本文「權限矩陣規則(逐條)」):**模組已勾、且直接子列只勾了一部分**。
`@repo/ui/tree` 只負責呈現,`indeterminateIds` 由本頁算好傳入;語意與 #207 的 story 一致。

### 其他

- 清單列的動作(編輯 / 停用 / 刪除)= **權限 × `Role.abilities`**(`rowAbilityOf`,`role-manager-types.ts`):權限決定「這個人能不能做這件事」、`abilities` 決定「這個角色讓不讓做」,兩者相乘才顯示按鈕。
- 「加入使用者」彈窗借 `users` query 取候選(ADR-0005),所以這個彈窗**額外需要 `system.user-manager.view`**;沒有時畫面顯示提示。**#261 起不再帶 `orgId` 只問子樹**:改問管理範圍內的全部使用者,逐列以 `orgTree` 判斷資格,子樹外的人**顯示但 disabled** 並就地說明原因(在此之前直接不列,找不到人的人只會以為那個人不見了)。判定權仍在 api(`USER_NOT_ELIGIBLE`),前端這一份只決定要不要灰掉 — 純函式在 `apps/admin/src/lib/role-eligibility.ts`。
- 刪除送出後收到 `ROLE_NOT_DELETABLE` 才攤開 `extensions.reasons` 三項,並提示改用停用。

### 角色選單怎麼分辨同名角色(#261 的 8)

三個地方列角色:資料範圍頁的套用對象「指定角色」、使用者頁的「指派角色」、角色管理頁的左清單。
每個租戶都有自己的「租戶管理員」,根組織視角只看角色名稱完全分不出來,所以兩層一起上,
共用純函式 `apps/admin/src/lib/role-options.ts`:

- 每一列「**角色名稱**」為主文字、「**擁有組織**」為次文字(選單裡是兩行;角色管理頁的左清單是單行,用 `roleOptionLabel` 接成「名稱 — 擁有組織」)。
- 跨兩個以上租戶頂層時,再依 `Role.ownerOrg.tenantTop` **分組**;單一租戶視角不分組 — 只有一組的標題是雜訊。判斷與取值是兩個函式(`shouldGroupRoles` / `roleGroupNameOf`),因為 MUI 的 `groupBy` 只要給了就一定畫標題;角色管理頁的左清單自己畫分段,另用 `groupRoleOptions` 取巢狀結構。
- **搜尋在選單裡**(#307):三個選單都是 `@repo/ui/autocomplete`,輸入即過濾(比對主文字)。在此之前是 MUI `Select` + **選單外**一個搜尋框 —— `Select` 會把選單裡的子元素一律 clone 成 `role="option"`,搜尋框塞進去會變成一個假選項,所以當時只能外掛。`Autocomplete` 的輸入框就是選單的觸發器,那個取捨消失,選單外的搜尋框與「依擁有組織篩選」下拉一併退場(角色管理頁**左清單**上方的那兩個是另一回事,它們是送給 api 的查詢條件,留著)。
- 不合格 / 停用 / 管理範圍外的選項**列出來但灰掉**,原因寫在該列的次文字 —— 不能用 Tooltip(MUI 對停用的選項關掉 pointer-events,詳見 STYLE-05)。
