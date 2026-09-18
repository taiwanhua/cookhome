# 使用者管理(技術)

- **模組 key**:`system.user-manager`
- **畫面**:Figma「Screen / Admin 使用者管理」30:105(左組織樹 + 右表格)+ 彈窗:新增使用者 202:728(含啟用方式 radio)/ 編輯使用者 86:162(同一個彈窗的兩個模式)、選擇所屬組織 92:222、確認所屬組織變更 95:1252(含移除時必出,radio 三檔)、指派角色 86:245、停用確認
- **相關 ADR**:[0003](../adr/0003-dual-account-system.md)(帳號、授予、移除)、[0004](../adr/0004-permission-model.md)、[0007](../adr/0007-base-fields-and-data-protection.md)(nationalId 欄位加密)、[0009](../adr/0009-tenant-provisioning.md)(擁有者保護、啟用信)
- **資料**:`users`、`core_relationships`(`org_user`、`user_role`)、`audit_logs`
- **使用者說明**:[system.user-manager.help.md](../../apps/admin/src/md/module-help/system.user-manager.help.md)

## 模組樹

| key                   | 名稱       | sidebarType       | 自有權限 |
| --------------------- | ---------- | ----------------- | -------- |
| `system.user-manager` | 使用者管理 | link(樹 + 表格頁) | 見權限表 |

沒有隱藏頁:所有動作都是頁上的彈窗。

## 權限表(綁定原則:綁「按鈕 / 欄位所在的那一頁」,ADR-0004)

每個模組固定有一筆 `<key>.*`(seed 自動產生,本表不列)。

| 權限 key                               | 它是哪一頁的什麼                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `system.user-manager.view`             | 看使用者清單與單筆資料(基本欄位、所屬組織、角色、狀態);沒有它整頁進不去內容              |
| `system.user-manager.create`           | 「新增使用者」按鈕 + API(含選擇啟用方式,見流程)                                          |
| `system.user-manager.edit`             | 「編輯」按鈕 + API:姓名、暱稱、性別、電話、地址、Email、帳號                             |
| `system.user-manager.toggle-enabled`   | 「停用 / 啟用」按鈕 + API;停用即刻作廢該使用者全部 refresh token                         |
| `system.user-manager.manage-orgs`      | 「選擇所屬組織」彈窗 + API:加入 / 移除所屬組織,移除時的 dry-run 與 radio 三檔            |
| `system.user-manager.assign-roles`     | 「指派角色」彈窗 + API:授予 / 解除角色(防越權:只能給操作者自己持有的角色與模組,ADR-0003) |
| `system.user-manager.show-national-id` | 欄位級:身分證字號可見(清單不顯示;詳情 / 編輯彈窗顯示解密後的值;無此權限 API 投影排除)    |
| `system.user-manager.edit-national-id` | 欄位級:身分證字號可改(無此權限硬送寫入 → API 拒)                                         |

## 畫面與流程

**清單範圍**:左側組織樹(以租戶頂層為根,可見範圍外節點 disabled)選一個組織 → 右側列出「該組織子樹的成員 ∩ 操作者可見組織集」(ADR-0005)。每列:姓名、帳號、Email、所屬組織、角色、狀態;角色欄以「組織外」標示失去擁有組織子樹支撐的授予(白話文案:使用者不在該角色的所屬組織內;樣式見 Figma)。

**新增使用者**(同一個彈窗,「新增」模式):姓名、帳號、Email、其他基本欄位(選填)、所屬組織(預設 = 目前選中的組織,可多選)、角色(選填)、**啟用方式二選一**:

- 預設「寄啟用信」:不設密碼,寄 7 天有效的啟用連結(ADR-0009;`PasswordService.sendActivationEmail`),使用者自行在「設定新密碼」頁設定
- 「直接設定初始密碼」:操作者輸入初始密碼(規則同 `@repo/domain/password`),`mustChangePassword = true`,首次登入強制改密碼(ADR-0009:僅用於同組織內手動新增)

帳號與 Email 各自在 `users` 內唯一(ADR-0003);重複 → `VALIDATION_FAILED` 列出欄位。

**編輯使用者**(「編輯」模式):基本欄位;所屬組織與角色各自有專用彈窗,不在這裡改。身分證字號依欄位級權限顯示 / 可改。

**停用 / 啟用**:確認彈窗;停用即刻作廢全部 refresh token(下次請求 `UNAUTHENTICATED`)。**擁有者保護**(ADR-0009):租戶擁有者不可被停用、不可被移出租戶、其「租戶管理員」授予不可被解除;根組織操作者可執行(處理擁有者失聯等例外)。

**所屬組織**:「選擇所屬組織」彈窗以樹勾選(勾 = 加入、取消 = 移除;只能勾操作者可見範圍內的組織)→ 有移除時必出「確認所屬組織變更」彈窗:API 先 dry-run 回「移除後失去資格的角色清單」,radio 三檔(ADR-0003):(a) 全部保留 (b) 解除該組織擁有的角色 (c) 解除所有失去資格的角色 = 該組織擁有的 + 失去全部子樹支撐的(**預設**)。「失去資格」逐筆判斷:該角色擁有組織的子樹 ∩ 使用者移除後剩餘的所屬組織 = 空集合。操作者的選擇與解除清單寫入 `audit_logs`。使用者至少要有一個所屬組織(最後一個不可移除)。

**指派角色**:清單 = 操作者可見範圍內、且操作者自己持有的角色(防越權,ADR-0003);已授予的顯示勾選;每個角色旁標示擁有組織。解除擁有者的「租戶管理員」授予被拒。

**密碼流程**(api 第 2 段 #64、admin 三頁 #68):「設定新密碼」頁共用三入口 — 啟用信(7 天,`PasswordService.sendActivationEmail`,由本模組新增使用者與開通租戶時呼叫)、重設信(30 分鐘,`requestPasswordReset`)、首登強改(`mustChangePassword` → `changePassword`);啟用與重設都走同一個 `setPassword(input: { token, newPassword })`,成功直接發登入 token;連結失效(`ACTION_TOKEN_INVALID`)頁導向忘記密碼自助;`action_tokens` 見 ADR-0009 / 0010。admin 端(`apps/admin/src/pages/auth/`):`/forgot-password`(任何 Email 都顯示已寄出)、`/set-password?token=…`(啟用與重設共用;成功持回傳 token 直接進後台;`ACTION_TOKEN_INVALID` 或無 token → 連結失效 + 一鍵重新申請)、`/change-password?next=…`(已登入;路由守門 `RequireAuth` 依 `me.mustChangePassword` 或 fetch 層攔到的 `MUST_CHANGE_PASSWORD` 導來,成功後清旗標、重取 `me`、回 `next`)。密碼規則即時提示與 api 同用 `@repo/domain/password`;文案在 `admin.forgotPassword` / `admin.setPassword` / `admin.changePassword` / `admin.passwordRules`。啟用信逾期走忘記密碼自助,本模組不提供重寄。

## 審計(ADR-0004:由模組層寫 `audit_logs`)

每個會改資料的動作寫一筆:`action` = `user.create`、`user.edit`、`user.toggle-enabled`、`user.add-org`、`user.remove-org`(`after` 含 radio 選項與解除的角色清單)、`user.grant-role`、`user.revoke-role`;`targetType = "user"`,`targetId` = 被操作的使用者;`before` / `after` 只放有變的欄位,**身分證字號永不寫進 audit_logs**(只記「已變更」)。

## 資料

`users` 欄位見 `account-base.schema.ts` / `user.schema.ts`(逐欄有註解);`nationalId` 欄位級加密、預設投影排除(ADR-0007)。清單查詢走 `org_user` 反查 + 可見範圍過濾,不做 populate(dis #28 的限制)。
