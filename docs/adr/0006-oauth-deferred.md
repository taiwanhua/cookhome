# OAuth 對外授權全部延後;屆時直接採 node-oidc-provider

目前不存在任何第三方串接方,故 v1 不自建任何 OAuth 端點(含 client_credentials)— 避免之後被 node-oidc-provider 取代的返工。第一個串接需求出現時,直接以 node-oidc-provider 一次承載兩種 grant:client_credentials(租戶的外部系統抓組織資料,client 綁定 Org、token 帶 orgId)與 authorization code + PKCE(第三方 app 讓會員授權存取自己的資料;同意畫面與登入頁可完全自定,儲存走 adapter、不動既有帳號表)。

現在僅預留:scope 目錄(種子資料,分組織資料/會員資料兩族,client 註冊時按族勾白名單)與 OAuth client 概念。自建跳轉流程被否決:redirect_uri 精確比對、state、code 一次性、PKCE、防重放等安全清單成本高於用庫。
