# 使用者管理(技術)

- **模組 key**:`system.user-manager`
- **畫面**:左組織樹 + 右表格;彈窗:新增/編輯使用者、選擇所屬組織(勾選=加入、取消=移除)、確認所屬組織變更(含移除時必出,radio 三檔)、指派角色、停用確認
- **相關 ADR**:[0003](../adr/0003-dual-account-system.md)(帳號、授予、移除)、[0004](../adr/0004-permission-model.md)、[0007](../adr/0007-base-fields-and-data-protection.md)
- **資料**:`users`、`core_relationships`(org_user、user_role)
- **清單範圍**:查詢組織子樹 ∩ 操作者可見組織集;組織樹以租戶頂層為根,範圍外節點 disabled
- **移除所屬組織**:radio 三檔 + dry-run,規則見 ADR-0003;角色欄以「組織外」標示失去擁有組織子樹支撐的角色授予(UI 文案用白話;樣式見 Figma)
- **密碼流程**(api 第 2 段 #64、admin 三頁 #68):「設定新密碼」頁共用三入口 — 啟用信(7 天,`PasswordService.sendActivationEmail`,由本模組新增使用者與開通租戶時呼叫)、重設信(30 分鐘,`requestPasswordReset`)、首登強改(`mustChangePassword` → `changePassword`);啟用與重設都走同一個 `setPassword(input: { token, newPassword })`,成功直接發登入 token;連結失效(`ACTION_TOKEN_INVALID`)頁導向忘記密碼自助;`action_tokens` 見 ADR-0009/0010
  - admin 端(`apps/admin/src/pages/auth/`):`/forgot-password`(任何 Email 都顯示已寄出)、`/set-password?token=…`(啟用與重設共用;成功持回傳 token 直接進後台;`ACTION_TOKEN_INVALID` 或無 token → 連結失效 + 一鍵重新申請)、`/change-password?next=…`(已登入;路由守門 `RequireAuth` 依 `me.mustChangePassword` 或 fetch 層攔到的 `MUST_CHANGE_PASSWORD` 導來,成功後清旗標、重取 `me`、回 `next`)。密碼規則即時提示與 api 同用 `@repo/domain/password`;文案在 `admin.forgotPassword` / `admin.setPassword` / `admin.changePassword` / `admin.passwordRules`
- **使用者說明**:[system.user-manager.help.md](../../apps/admin/src/md/module-help/system.user-manager.help.md)
