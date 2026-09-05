# 使用者與會員是兩套帳號體系:分表、分登入、分 token

admin 的使用者(User)與 front 的會員(Customer)分兩張 collection、各自的登入端點,JWT 以 `aud` 區隔、互不通用。會員不進 RBAC(不綁角色)— 會員能力是固定集合 + 資料擁有權檢查;後台的角色/權限體系只服務使用者。

token 設計:短效 access token(HS256,密鑰在 Secret Manager)+ 長效 refresh token(獨立 collection 存雜湊,支援輪替與「登出所有裝置」)。簽章演算法不落資料庫,未來第三方需驗章時換 RS256+JWKS 成本僅在設定層(約半天)。密碼一律 argon2id(或 bcrypt)雜湊,禁明文與可逆加密。

使用者可屬多組織(`org_user`),token 只帶單一「當前組織」;跨租戶的角色差異由 `org_user_role` 三元關聯表達。
