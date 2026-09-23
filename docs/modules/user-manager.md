# 使用者管理(技術)

## 用途

管理後台使用者:在操作者的管理範圍內新增(寄啟用信或直接設初始密碼)、編輯基本資料、停用 / 啟用、調整所屬組織(含移除時的角色資格 dry-run)、指派角色;身分證字號受欄位級權限控管。相關 ADR:[0003](../adr/0003-dual-account-system.md)(帳號、授予、移除)、[0004](../adr/0004-permission-model.md)、[0007](../adr/0007-base-fields-and-data-protection.md)(nationalId 欄位加密)、[0009](../adr/0009-tenant-provisioning.md)(擁有者保護、啟用信)。

正本:`apps/api/src/users/`、`apps/admin/src/pages/system/UserManagerPage/`

## 模組 key 與畫面

| key                   | 名稱       | sidebarType       | 自有權限 |
| --------------------- | ---------- | ----------------- | -------- |
| `system.user-manager` | 使用者管理 | link(樹 + 表格頁) | 見權限表 |

- 路由:`/system/user-manager`。沒有隱藏頁:所有動作都是頁上的彈窗。
- Figma「Screen / Admin 使用者管理」30:105(左組織樹 + 右表格)+ 彈窗:新增使用者 202:728(含啟用方式 radio)/ 編輯使用者 86:162(同一個彈窗的兩個模式)、選擇所屬組織 92:222、確認所屬組織變更 95:1252(含移除時必出,radio 三檔)、指派角色 86:245、停用確認。

正本:`apps/db-migrator/seeds/modules/system.ts`、`apps/admin/src/app/module-pages.tsx`

## 權限表

綁定原則:綁「按鈕 / 欄位所在的那一頁」(ADR-0004)。每個模組固定有一筆 `<key>.*`(seed 自動產生,本表不列)。

| 權限 key                               | 它是哪一頁的什麼                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `system.user-manager.view`             | 看使用者清單與單筆資料(基本欄位、所屬組織、角色、狀態);沒有它整頁進不去內容                  |
| `system.user-manager.create`           | 「新增使用者」按鈕 + API(含選擇啟用方式,見規則)                                              |
| `system.user-manager.edit`             | 「編輯」按鈕 + API:姓名、暱稱、性別、電話、地址、Email、帳號                                 |
| `system.user-manager.toggle-enabled`   | 「停用 / 啟用」按鈕 + API;停用即刻作廢該使用者全部 refresh token                             |
| `system.user-manager.manage-orgs`      | 「選擇所屬組織」彈窗 + API:加入 / 移除所屬組織,移除時的 dry-run 與 radio 三檔                |
| `system.user-manager.assign-roles`     | 「指派角色」彈窗 + API:授予 / 解除角色(防越權:只能給**擁有組織在管理範圍內**的角色,ADR-0003) |
| `system.user-manager.show-national-id` | 欄位級:身分證字號可見(清單不顯示;詳情 / 編輯彈窗顯示解密後的值;無此權限 API 投影排除)        |
| `system.user-manager.edit-national-id` | 欄位級:身分證字號可改(無此權限硬送寫入 → API 拒)                                             |

正本:`apps/db-migrator/seeds/modules/system.ts`、`apps/admin/src/pages/system/UserManagerPage/user-manager-permissions.ts`

## 資料

- `users`:欄位見 schema(逐欄有註解);`nationalId` 欄位級加密、預設投影排除(ADR-0007)。帳號與 Email 各自在 `users` 內唯一(ADR-0003),唯一索引含已軟刪除的文件。
- `core_relationships`:`org_user`(所屬組織)、`user_role`(角色授予)。
- `audit_logs`:見「稽核」。
- 清單查詢走 `org_user` 反查 + 管理範圍過濾(組織經 `OrgsRepository`,治理類自動吃 `managedOrgIds`),不做 populate。
- seed:只有超級管理員 `root` 一個帳號(屬根組織);其餘使用者由本模組新增或由開通租戶產生。

正本:`apps/api/src/database/schemas/account-base.schema.ts`、`apps/api/src/database/schemas/user.schema.ts`、`apps/api/src/database/schemas/core-relationship.schema.ts`、`apps/db-migrator/seeds/root-admin.ts`

## 規則

**清單範圍**:左側組織樹 = 操作者的**管理範圍**(CONTEXT.md;根 = 持有角色的擁有組織),選一個組織 → 右側列出「該組織子樹的成員 ∩ 管理範圍」。每列:姓名、帳號、Email、所屬組織、角色、狀態;角色欄以「組織外」標示失去擁有組織子樹支撐的授予(白話文案:使用者不在該角色的所屬組織內;樣式見 Figma)。

**新增使用者**(同一個彈窗,「新增」模式):姓名、帳號、Email、其他基本欄位(選填)、所屬組織(預設 = 目前選中的組織,可多選)、角色(選填)、**啟用方式二選一**:

- 預設「寄啟用信」:不設密碼,寄 7 天有效的啟用連結(ADR-0009;`PasswordService.sendActivationEmail`),使用者自行在「設定新密碼」頁設定。
- 「直接設定初始密碼」:操作者輸入初始密碼(規則同 `@repo/domain/password`),`mustChangePassword = true`,首次登入強制改密碼(ADR-0009:僅用於同組織內手動新增)。

帳號或 Email 重複 → `VALIDATION_FAILED` 列出欄位。

**編輯使用者**(「編輯」模式):基本欄位;所屬組織與角色各自有專用彈窗,不在這裡改。身分證字號依欄位級權限顯示 / 可改。

**停用 / 啟用**:確認彈窗;停用即刻作廢全部 refresh token(下次請求 `UNAUTHENTICATED`)。

**擁有者保護**(ADR-0009):租戶擁有者不可被停用、不可被移出他擁有的租戶頂層、其「租戶管理員」授予不可被解除;根組織操作者可執行(處理擁有者失聯等例外)。**擁有者可以加入其他組織** —— 保護只針對「移出」。

**所屬組織**:「選擇所屬組織」彈窗(`OrgPickerDialog`)以樹勾選(勾 = 加入、取消 = 移除;只能勾操作者管理範圍內的組織)→ 有移除時必出「確認所屬組織變更」彈窗(`OrgChangeDialog`;兩支名字相近,指路時寫全名):API 先 dry-run 回「移除後失去資格的角色清單」,radio 三檔(ADR-0003)。「失去資格」逐筆判斷:該角色擁有組織的子樹 ∩ 使用者移除後剩餘的所屬組織 = 空集合。操作者的選擇與解除清單寫入 `audit_logs`。

**三個 radio 的畫面文案正本在這裡**(i18n 的 `admin.userManager.orgChange.*`,兩語系同步):寫劇本或票面時引用這三句,不要只寫「三選一」。

| `removalPolicy`          | 選項文字                   | 底下那一行說明                                                     |
| ------------------------ | -------------------------- | ------------------------------------------------------------------ |
| `KEEP_ALL`               | 保留所有角色授予           | 角色功能對他繼續有效;可操作的資料範圍仍由所屬組織決定,列表會有標示 |
| `REVOKE_OWNED_BY_ORG`    | 只解除此組織擁有的角色     | 將解除:`{roles}`(逐筆列「角色名(擁有組織)」)                       |
| `REVOKE_ALL_UNQUALIFIED` | 解除所有因此失去資格的角色 | 將解除:`{roles}`;**這是預設選項**                                  |

彈窗標題「確認所屬組織變更?」;沒有任何角色受影響時顯示「沒有角色會因此失去資格。」,擁有者保護的那一筆標「`{role}` 受擁有者保護,不會被解除」;dry-run 逐筆回的 `reasons` 在畫面上是「由被移除的組織擁有」/「剩餘的所屬組織都不在該角色的擁有組織底下」(兩者可同時成立)。

**使用者至少要有一個所屬組織(最後一個不可移除,錯誤碼 `LAST_ORG`)—— 這條規則的正本就是這一段**(ADR-0003「從組織移除使用者」引用它)。它與組織刪除的前置檢查「無成員」會**互相咬住**:租戶頂層一定有擁有者這個成員,而要把擁有者移出去又同時被本條與擁有者保護擋下。所以開錯的租戶走「撤銷開通」,不走刪除 —— 見 `docs/modules/org-manager.md` 規則的「撤銷開通」。

**指派角色**:清單 = `roles` query 的結果 = 擁有組織在操作者**管理範圍**內的角色(防越權,ADR-0003;與角色頁的 `grantRoleUsers` 同一條判準,不另外要求「操作者自己也持有」—— 兩套判準會讓同一個授予從角色頁做得到、從使用者頁做不到);已授予的顯示勾選;每列標示擁有組織與描述,已停用的角色不可新勾、租戶副本掛標籤。授予當下另檢查資格(所屬組織 ∩ 擁有組織子樹)。解除擁有者的「租戶管理員」授予被拒。

**全量覆蓋的邊界**:`setUserOrgs` 只覆蓋操作者**管理範圍內**的所屬組織,`assignUserRoles` 只覆蓋操作者**可觸及**(擁有組織在管理範圍內)的角色 —— 彈窗列不出來的那些不會被順手移除。

**密碼流程**:「設定新密碼」頁共用三入口 —— 啟用信(7 天,`PasswordService.sendActivationEmail`,由本模組新增使用者與開通租戶時呼叫)、重設信(30 分鐘,`requestPasswordReset`)、首登強改(`mustChangePassword` → `changePassword`);啟用與重設都走同一個 `setPassword(input: { token, newPassword })`,成功直接發登入 token;連結失效(`ACTION_TOKEN_INVALID`)頁導向忘記密碼自助;`action_tokens` 見 ADR-0009 / 0010。啟用信逾期走忘記密碼自助,本模組不提供重寄。

**為什麼新增與編輯對 `nationalId: null` 不同調**:`null` 在編輯是「把既有的值清掉」= 一次寫入,在新增是「這欄我不填」= 沒有東西可清。把新增的 `null` 也擋下,只會讓沒有 `edit-national-id` 的人連「不填身分證字號的使用者」都建不了。這與示範模組1 的 `internalNote`(`null` 一律要權限)方向不同 —— 那裡只有編輯一種情境。通則寫在 GQL-06。

正本:`apps/api/src/users/users.service.ts`、`apps/api/src/users/org-qualification.service.ts`、`apps/api/src/orgs/owner-protection.service.ts`、`apps/api/src/auth/password/password.service.ts`、`packages/domain/src/password/`、`packages/i18n/messages/zh-TW/admin.json`

## api 介面

```graphql
users(input: { orgId, page, pageSize, keyword }): UsersPayload!   # items + totalCount + page + pageSize
user(id: ID!): User!
createUser(input: { …基本欄位, nationalId, orgIds, roleIds, activation: { mode: EMAIL | PASSWORD, initialPassword } }): UserPayload!
updateUser(input: { id, …基本欄位, nationalId }): UserPayload!
setUserEnabled(input: { id, enabled }): UserPayload!
setUserOrgs(input: { userId, orgIds, dryRun, removalPolicy }): SetUserOrgsPayload!
assignUserRoles(input: { userId, roleIds }): UserPayload!
```

- **清單範圍**:不給 `orgId` 即攤開整個**管理範圍**(治理模組慣例,ADR-0005 的分工表);給了就是該組織子樹 ∩ 管理範圍。組織子樹直接查 `orgs.ancestors`,範圍過濾由 BaseRepository 自動加上(`orgs` 是治理類 collection)。`pageSize` 上限 100。
- **每列的 `roles[].outOfScope`** = 「組織外」標記,與移除 dry-run 用同一份資格判斷(`OrgQualificationService`)。判斷子樹歸屬時**刻意不套任何範圍**(ADR-0005:可見性開關與管理範圍都不影響授予資格),但顯示用的組織名稱仍只給管理範圍內的,範圍外只露 id。
- **`nationalId`**:`user(id)` 持 `show-national-id` 才以 `select("+nationalId")` 取回並解密,清單一律不回;寫入需 `edit-national-id`,否則 `FORBIDDEN`。
- **`removalPolicy`**:`KEEP_ALL` / `REVOKE_OWNED_BY_ORG` / `REVOKE_ALL_UNQUALIFIED`(預設)。`unqualifiedRoles` 逐筆附 `reasons`(`OWNED_BY_REMOVED_ORG` / `NO_REMAINING_SUBTREE_SUPPORT`,可同時成立)與 `ownerProtected`。
- **防越權**:`ROLE_OUT_OF_REACH` = 要授予的角色其**擁有組織不在操作者的管理範圍內**。管理範圍是 `"all"`(超級管理員 / 擁有組織為根組織)時全權放行,否則根組織無法把租戶的角色授予任何人。
- **授予資格**:不符回 **`USER_NOT_ELIGIBLE`** 附 `extensions.roleId` / `ownerOrgName`,讓前端講得出是哪個擁有組織。判斷本身是**唯一的檢查點** `OrgQualificationService.assertEligible`,與角色頁的 `grantRoleUsers` 共用 —— 同一件事不該因為入口不同而回不同的碼。
- **擁有者保護的判斷點**:`assertOwnedOrgsKept` 只擋「把擁有者移出他擁有的租戶頂層」,加入其他組織一直是允許的。
- 組織頁的「加入成員」(`addOrgMembers`)也寫進這裡的 `UsersService.addOrgs`,見 `docs/modules/org-manager.md`。

**可選輸入欄位的「缺席 / `null`」語意**(GQL-06):

| 端點 / 欄位                                                              | 缺席                         | `null`                                                                   |
| ------------------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------ |
| `createUser.nationalId`                                                  | 不寫                         | **視同缺席**:不寫、**不要求 `edit-national-id`**(新增時沒有東西可清)     |
| `updateUser.nationalId`                                                  | 不動                         | **清空**:是一次寫入,**要 `edit-national-id`**,沒有就 `FORBIDDEN`         |
| `updateUser` 的必填欄位(`name` / `account` / `email`)                    | 不動                         | **不接受**:`null` 與空字串同義,一律 `VALIDATION_FAILED`(不會把姓名清掉)  |
| `updateUser` 的選填基本欄位(`nickname` / `gender` / `phone` / `address`) | 不動                         | 清空該欄(空字串同 `null`;落庫寫 `null` 不是 `$unset`,ADR-0002)           |
| `createUser.activation.initialPassword`                                  | 只在 `mode: PASSWORD` 時必填 | `mode: EMAIL` 時不看這欄                                                 |
| `UsersInput.orgId`                                                       | 整個管理範圍                 | **不接受**:前端永遠不送 `null`,送了會在 `toObjectId` 擋下(見 admin 頁面) |
| `UsersInput.keyword`                                                     | 不篩                         | 同缺席                                                                   |

正本:`apps/api/src/users/users.resolver.ts`、`apps/api/src/users/dto/`、`apps/api/src/users/models/`、`packages/graphql/src/documents/users.graphql`

## admin 頁面

左 `OrgTreePicker`(跨頁共用,`components/OrgTreePicker/`;組織管理也用)+ 右 `Table` / `Pagination`;五個彈窗各一個資料夾,狀態一律在頁面層,關閉即卸載(初始值靠 props 帶入,不用 effect 同步,REACT-06)。

- **初始狀態**:進頁面預設選中**樹根**(= 操作者管理範圍的根,與組織管理頁一致),樹還沒載完之前不送 `users`(右側顯示載入中)。前端**永遠不送 `orgId: null`** —— `UsersInput.orgId` 是「不給 = 整個管理範圍」,給 null 會在 API 的 `toObjectId` 擋下(`orgId is not a valid id: null`)。樹不可用時才走「不給 `orgId`」那條路。
- **組織樹的權限**:admin 目前以 `system.org-manager.view` 判斷樹可不可用(`user-manager-permissions.ts` 的 `ORG_MANAGER_VIEW_PERMISSION`,**頁內判斷**,ADR-0011):沒有那個 key 就不送查詢,清單改成不給 `orgId`(= 整個管理範圍),「所屬組織」動作 disabled。api 的 `orgTree` / `org` 其實已接受 `system.user-manager.view` 任一(見 `docs/modules/org-manager.md` api 介面),admin 這一側的判斷尚未放寬。
- **角色清單**:指派角色彈窗用正式的 `roles` query,範圍與 api 防越權(`ROLE_OUT_OF_REACH`)同一條 —— 擁有組織在操作者管理範圍內,角色的**描述文字**(Figma 86:245)也從這裡來。已授予但操作者觸及不到的角色仍唯讀顯示,送出時不包含(api 也不會動它)。
  - 每一列標「角色名稱 — 擁有組織」,跨租戶時依 `ownerOrg.tenantTop` 分組並可搜尋(共用 `apps/admin/src/lib/role-options.ts`,規則見 `docs/modules/role-manager.md` admin 頁面的「角色選單怎麼分辨同名角色」)。
  - **沒有授予資格的角色顯示但 disabled** 並就地說明「此角色只能授予 <擁有組織> 及其下層的使用者」,不等到送出才吃到錯。資格以 `orgTree` 算(`lib/role-eligibility.ts`),判定權仍在 api。
- **擁有者保護只需要一個 id**:前端不重做 `owner-protection.service.ts` 的判斷,只取 `org(樹根 id)`:`parentId === null` 代表操作者站在根組織 → 一律放行不標保護;否則樹根就是租戶頂層,它的 `ownerUserId` 就是受保護的那一位(`protectedOwnerUserId`),該列的「停用」disabled 並提示。
  - **「所屬組織」照常可開**:api 只擋「把擁有者移出他擁有的租戶頂層」,整個按鈕 disabled 會比 api 嚴,擁有者連把自己加進分店都做不到。鎖在彈窗裡:樹根(= 他擁有的租戶頂層,`protectedOwnerOrgId`)那一個節點以 `Tree` 的 `disabledCheckIds` 鎖住(維持勾選、取消不掉),其餘組織照常可勾可取消。「哪個組織是他擁有的」不必向 api 多要欄位 —— `protectedOwnerUserId` 本來就是從樹根的 `ownerUserId` 來的。
  - api 仍會回 `OWNER_PROTECTED`,彈窗照樣顯示訊息(fail-closed 在後端,前端只是先講清楚)。
- **密碼三頁**(`apps/admin/src/pages/auth/`):`/forgot-password`(任何 Email 都顯示已寄出)、`/set-password?token=…`(啟用與重設共用;成功持回傳 token 直接進後台;`ACTION_TOKEN_INVALID` 或無 token → 連結失效 + 一鍵重新申請)、`/change-password?next=…`(已登入;路由守門 `RequireAuth` 依 `me.mustChangePassword` 或 fetch 層攔到的 `MUST_CHANGE_PASSWORD` 導來,成功後清旗標、重取 `me`、回 `next`)。密碼規則即時提示與 api 同用 `@repo/domain/password`;文案在 `admin.forgotPassword` / `admin.setPassword` / `admin.changePassword` / `admin.passwordRules`。
- **與 Figma 的差異(刻意)**:清單多一欄「帳號」(30:105 沒有,但清單欄位的正本是本文);列動作多一個「所屬組織」(31:98 只有編輯 / 指派角色 / 停用,但所屬組織需要入口);新增彈窗的「初始密碼」欄改成選了 PASSWORD 才出現(202:743 常駐);新增 / 編輯彈窗的「啟用此使用者」勾選框不做(`createUser` / `updateUser` 沒有 `enabled` 欄位,啟用停用走專用動作);編輯彈窗的所屬組織唯讀(所屬組織走專用彈窗)。

正本:`apps/admin/src/pages/system/UserManagerPage/`(`useUserManagerData.ts`、`useUserOrgsFlow.ts`、`OrgPickerDialog/`、`OrgChangeDialog/`、`AssignRolesDialog/`)、`apps/admin/src/components/OrgTreePicker/OrgTreePicker.tsx`、`apps/admin/src/lib/role-eligibility.ts`、`apps/admin/src/pages/auth/`

## 錯誤碼

| code                | 何時                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------- |
| `LAST_ORG`          | 移除最後一個所屬組織                                                                   |
| `ROLE_OUT_OF_REACH` | 授予的角色擁有組織不在操作者管理範圍內                                                 |
| `USER_NOT_ELIGIBLE` | 授予資格不符;`extensions.roleId` / `ownerOrgName`                                      |
| `OWNER_PROTECTED`   | 停用擁有者、把擁有者移出他擁有的租戶頂層、解除擁有者的租戶管理員授予                   |
| `VALIDATION_FAILED` | 帳號 / Email 重複(`extensions.fields` 指出欄位)、必填欄位送 `null` / 空字串、id 不合法 |
| `FORBIDDEN`         | 權限不足;寫 `nationalId` 沒有 `edit-national-id`                                       |
| `NOT_FOUND`         | 使用者不在管理範圍內                                                                   |

錯誤碼總表在 GQL-04。前端解讀集中在 `user-manager-error.ts`。

正本:`apps/api/src/users/users-error.ts`、`apps/admin/src/pages/system/UserManagerPage/user-manager-error.ts`、`docs/standards/api/graphql-schema.md`

## 稽核

由模組層寫 `audit_logs`(ADR-0004)。每個會改資料的動作寫一筆:`action` = `user.create`、`user.edit`、`user.toggle-enabled`、`user.add-org`、`user.remove-org`(`after` 含 radio 選項與解除的角色清單)、`user.grant-role`、`user.revoke-role`;`targetType = "user"`,`targetId` = 被操作的使用者;`before` / `after` 只放有變的欄位,**身分證字號永不寫進 audit_logs**(只記「已變更」)。組織頁的「加入成員」同樣寫 `user.add-org`。

正本:`apps/api/src/users/users.service.ts`

## 測試

- api:`apps/api/src/users/users.test.ts`;密碼流程 `apps/api/src/auth/password/password.test.ts`
- admin:`apps/admin/src/pages/system/UserManagerPage/UserManagerPage.test.tsx`、`UserManagerFeedback.test.tsx`、`AssignRolesDialog/AssignRolesDialog.test.tsx`(共用 `user-manager-test-support.ts`)
- 劇本(`docs/testing/permission-scenarios.md`):劇本 8 組織外、劇本 9 移除所屬組織的 dry-run 三檔、劇本 14 管理範圍 vs 可見範圍、劇本 17 擁有者保護;E2E 為 `apps/e2e/src/specs/scenario-08-out-of-scope.spec.ts`、`scenario-09-org-removal-policy.spec.ts`、`scenario-14-management-scope.spec.ts`、`scenario-17-owner-protection.spec.ts`

正本:`apps/api/src/users/`、`apps/admin/src/pages/system/UserManagerPage/`、`apps/e2e/src/specs/`、`docs/testing/permission-scenarios.md`

## 使用者說明(help.md)

[system.user-manager.help.md](../../apps/admin/src/md/module-help/system.user-manager.help.md)(build 時打包進說明彈窗;讀者是租戶使用者,不得出現平台視角詞彙)。

正本:`apps/admin/src/md/module-help/system.user-manager.help.md`

## 平台視角備註

**擁有者保護的實作**(ADR-0009),程式在 `apps/api/src/orgs/owner-protection.service.ts`(由 `OrgsModule` 匯出給 `UsersModule` 用,與組織管理的租戶頂層保護、租戶作業共用):

- 擁有者 = 任一 `orgs.ownerUserId` 等於該使用者;**根組織操作者**(`isRootOperator`)一律放行。
- 受保護的角色授予 = 該使用者擁有的組織所擁有、且帶租戶管理員模板標記的角色;標記為 `roles.key === "tenant-admin"`(模板本身)或 **`roles.settings.templateKey === "tenant-admin"`(開通租戶複製出來的副本)** —— `provisionTenant` 建副本時必須寫入這個標記,否則保護認不出那一筆。
- 擁有者 / 根組織的判斷**不套任何範圍**(以 `visibleOrgIds` / `managedOrgIds` 皆為 `"all"` 讀,只取 `ownerUserId` / `parentId`):租戶頂層可能不在操作者的管理範圍內,查不到就等於保護失效,安全檢查要 fail-closed。

正本:`apps/api/src/orgs/owner-protection.service.ts`、`docs/adr/0009-tenant-provisioning.md`
